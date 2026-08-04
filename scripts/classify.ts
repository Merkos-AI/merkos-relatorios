import { NAO_MAPEADO, SAUDACOES_OUTROS } from './categories.js';
import type { SessionDetail } from './queries.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'openai/gpt-4o-mini';
const CHUNK_SIZE = 40;

interface ToClassify {
  sessionId: string;
  text: string;
}

export async function classifySessions(
  sessions: SessionDetail[],
  categories: string[],
  orgName: string,
): Promise<Map<string, string>> {
  const toClassify: ToClassify[] = sessions
    .filter((s) => s.lastUserMessages.length > 0)
    .map((s) => ({ sessionId: s.sessionId, text: s.lastUserMessages.join(' | ') }));

  const result = new Map<string, string>();
  if (toClassify.length === 0) return result;

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY nao configurada');

  for (let i = 0; i < toClassify.length; i += CHUNK_SIZE) {
    const chunk = toClassify.slice(i, i + CHUNK_SIZE);
    const classified = await classifyChunk(chunk, categories, orgName, apiKey);
    for (const [id, cat] of classified) result.set(id, cat);
  }

  return result;
}

async function classifyChunk(
  chunk: ToClassify[],
  categories: string[],
  orgName: string,
  apiKey: string,
): Promise<Map<string, string>> {
  const categoryList = categories.map((c, i) => `${i + 1}. ${c}`).join('\n');

  const prompt = `Você classifica mensagens de clientes de "${orgName}" que precisaram de atendimento humano no WhatsApp.

Categorias fixas disponíveis:
${categoryList}

Se a mensagem não se encaixar claramente em NENHUMA categoria acima, use exatamente: "${NAO_MAPEADO}". Não force um encaixe forçado — é melhor usar essa categoria do que classificar errado.
Se a mensagem for só uma saudação, agradecimento, ou não tiver assunto claro, use exatamente: "${SAUDACOES_OUTROS}".

Conversas a classificar (id -> últimas mensagens do cliente antes do atendimento humano):
${chunk.map((c) => `${c.sessionId}: ${c.text}`).join('\n')}

Responda SOMENTE com um JSON válido no formato:
{"<sessionId>": "<categoria exata da lista acima, ou uma das duas categorias especiais>", ...}`;

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`OpenRouter falhou (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  const raw = data.choices[0]?.message?.content ?? '{}';

  let parsed: Record<string, string>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error('Falha ao parsear resposta da IA:', raw);
    parsed = {};
  }

  const validCategories = new Set([...categories, NAO_MAPEADO, SAUDACOES_OUTROS]);
  const map = new Map<string, string>();
  for (const c of chunk) {
    const category = parsed[c.sessionId];
    map.set(c.sessionId, validCategories.has(category) ? category : NAO_MAPEADO);
  }
  return map;
}
