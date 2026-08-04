import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { STARRED } from './categories.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface ReportData {
  orgName: string;
  periodLabel: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  messages: { USER: number; AGENT: number; HUMAN: number };
  totalConversas: number;
  resolvidaIa: number;
  comHumano: number;
  categoryCounts: Array<{ category: string; count: number }>;
  totalMessagesForSource: number;
  insights: Record<string, { title: string; body: string }>;
}

function genericInsight(category: string): { title: string; body: string } {
  return {
    title: category,
    body: 'Essas perguntas já têm resposta padrão hoje. Cadastrando essas informações na base de conhecimento, a IA responde na hora — inclusive fora do horário comercial.',
  };
}

function logoBase64(): string {
  const buf = readFileSync(path.join(__dirname, 'assets', 'merkos-logo.png'));
  return `data:image/png;base64,${buf.toString('base64')}`;
}

function pct(part: number, total: number): string {
  if (total === 0) return '0,0';
  return ((part / total) * 100).toFixed(1).replace('.', ',');
}

function bar(count: number, max: number): string {
  const width = max === 0 ? 0 : Math.round((count / max) * 100);
  return `${width}%`;
}

export function renderReport(data: ReportData): string {
  const logo = logoBase64();
  const totalResolvidas = data.resolvidaIa + data.comHumano;
  const resolvidaPct = pct(data.resolvidaIa, totalResolvidas);
  const humanoPct = pct(data.comHumano, totalResolvidas);
  const resolvidaWidth = totalResolvidas === 0 ? 0 : (data.resolvidaIa / totalResolvidas) * 100;

  const sortedCategories = [...data.categoryCounts].sort((a, b) => b.count - a.count);
  const maxCount = sortedCategories.length > 0 ? sortedCategories[0].count : 0;
  const totalHumano = data.comHumano || 1;

  const categoryRows = sortedCategories
    .map((c) => {
      const isStarred = STARRED.has(c.category);
      return `
        <div class="cat-row">
          <div class="cat-label">${c.category}${isStarred ? ' *' : ''}</div>
          <div class="cat-bar-track"><div class="cat-bar-fill ${isStarred ? 'muted' : ''}" style="width:${bar(c.count, maxCount)}"></div></div>
          <div class="cat-value">${c.count} · ${pct(c.count, totalHumano)}%</div>
        </div>`;
    })
    .join('\n');

  const eligibleForInsights = sortedCategories.filter((c) => !STARRED.has(c.category));

  const topInsights = eligibleForInsights
    .slice(0, 3)
    .map((c) => {
      const insight = data.insights[c.category] ?? genericInsight(c.category);
      return `
        <div class="insight-card">
          <span class="insight-tag">${pct(c.count, totalHumano)}% das conversas</span>
          <h3>${insight.title}</h3>
          <p>${insight.body}</p>
        </div>`;
    })
    .join('\n');

  const insightsTotalPct = eligibleForInsights
    .slice(0, 3)
    .reduce((sum, c) => sum + (c.count / totalHumano) * 100, 0);

  const messagesPerDay = Math.round(data.messages.USER / data.totalDays);
  const totalMsgs = data.messages.USER + data.messages.AGENT + data.messages.HUMAN;

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Relatório de Atendimento com IA — ${data.orgName}</title>
<style>
  :root {
    --dark: #171110;
    --red: #c8102e;
    --blue: #2f6fdb;
    --gray: #5c5c5c;
    --border: #e5e2e0;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #1f1f1f;
    background: #fff;
    max-width: 880px;
    margin: 0 auto;
    padding-bottom: 60px;
  }
  header {
    background: var(--dark);
    color: #fff;
    padding: 28px 32px;
  }
  header img { height: 32px; margin-bottom: 16px; }
  header h1 { font-size: 20px; margin: 0 0 4px; }
  header p { margin: 0; opacity: 0.75; font-size: 14px; }
  main { padding: 32px; }
  h2 { font-size: 26px; margin-bottom: 8px; }
  .lead { color: var(--gray); line-height: 1.5; margin-bottom: 28px; }
  .cards { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 32px; }
  .card {
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 20px;
  }
  .card .num { font-size: 32px; font-weight: 800; }
  .card .num.red { color: var(--red); }
  .card .num.blue { color: var(--blue); }
  .card .label { margin-top: 4px; font-size: 14px; }
  .card .sub { color: var(--gray); font-size: 13px; }
  section { border: 1px solid var(--border); border-radius: 12px; padding: 24px; margin-bottom: 24px; }
  section h3 { margin-top: 0; font-size: 18px; }
  section .desc { color: var(--gray); font-size: 14px; margin-bottom: 16px; }
  .split-bar { display: flex; height: 28px; border-radius: 6px; overflow: hidden; margin-bottom: 10px; }
  .split-bar .ia { background: var(--red); }
  .split-bar .humano { background: var(--blue); }
  .legend { display: flex; gap: 24px; font-size: 14px; }
  .legend .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; }
  .legend .ia-dot { background: var(--red); }
  .legend .humano-dot { background: var(--blue); }
  .cat-row { display: grid; grid-template-columns: 220px 1fr 110px; align-items: center; gap: 12px; margin-bottom: 14px; font-size: 14px; }
  .cat-bar-track { background: #f1efee; border-radius: 6px; height: 14px; overflow: hidden; }
  .cat-bar-fill { background: var(--red); height: 100%; }
  .cat-bar-fill.muted { background: #b9b6b4; }
  .cat-value { text-align: right; color: var(--gray); font-size: 13px; }
  .footnote { font-size: 12px; color: var(--gray); margin-top: 8px; }
  .insight-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .insight-card { border: 1px solid var(--border); border-radius: 12px; padding: 18px; }
  .insight-tag { display: inline-block; background: #fde8ea; color: var(--red); font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 999px; margin-bottom: 10px; }
  .insight-card h3 { font-size: 15px; margin: 0 0 6px; }
  .insight-card p { font-size: 13px; color: var(--gray); margin: 0; line-height: 1.5; }
  .highlight { background: #fde8ea; border-radius: 12px; padding: 18px 20px; font-size: 15px; }
  .highlight b { color: var(--red); }
  footer { padding: 24px 32px; font-size: 12px; color: var(--gray); border-top: 1px solid var(--border); }
  footer b { color: #1f1f1f; }
</style>
</head>
<body>
  <header>
    <img src="${logo}" alt="Merkos" />
    <h1>Relatório de Atendimento com IA</h1>
    <p>${data.orgName} · ${data.periodLabel}</p>
  </header>
  <main>
    <h2>Como a IA atendeu seus clientes no WhatsApp</h2>
    <p class="lead">Resumo de todas as conversas do período: o volume de mensagens, quanto a assistente virtual resolveu sozinha e quais assuntos ainda precisaram da sua equipe — com as oportunidades para a IA atender ainda mais.</p>

    <div class="cards">
      <div class="card"><div class="num">${data.messages.USER.toLocaleString('pt-BR')}</div><div class="label">Mensagens recebidas de clientes</div><div class="sub">≈ ${messagesPerDay} por dia</div></div>
      <div class="card"><div class="num red">${data.messages.AGENT.toLocaleString('pt-BR')}</div><div class="label">Respostas enviadas pela IA</div><div class="sub">automáticas, em segundos</div></div>
      <div class="card"><div class="num blue">${data.messages.HUMAN.toLocaleString('pt-BR')}</div><div class="label">Mensagens enviadas pela equipe</div><div class="sub">atendimento humano</div></div>
      <div class="card"><div class="num">${data.totalConversas.toLocaleString('pt-BR')}</div><div class="label">Conversas no período</div><div class="sub">${data.totalDays} dias</div></div>
    </div>

    <section>
      <h3>Quem atendeu cada conversa</h3>
      <p class="desc">Das ${data.totalConversas.toLocaleString('pt-BR')} conversas, a IA resolveu ${data.resolvidaIa.toLocaleString('pt-BR')} do início ao fim. As outras ${data.comHumano.toLocaleString('pt-BR')} tiveram participação da equipe — por transferência da IA ou contato direto.</p>
      <div class="split-bar"><div class="ia" style="width:${resolvidaWidth}%"></div><div class="humano" style="width:${100 - resolvidaWidth}%"></div></div>
      <div class="legend">
        <span><span class="dot ia-dot"></span>Resolvidas 100% pela IA — <b>${data.resolvidaIa} (${resolvidaPct}%)</b></span>
        <span><span class="dot humano-dot"></span>Com atendimento humano — <b>${data.comHumano} (${humanoPct}%)</b></span>
      </div>
    </section>

    <section>
      <h3>Assuntos das conversas que foram para a equipe</h3>
      <p class="desc">Cada uma das ${data.comHumano.toLocaleString('pt-BR')} conversas com atendimento humano foi classificada pelo assunto que motivou a participação da equipe.</p>
      ${categoryRows}
      <p class="footnote">* Não são limitações da IA: mensagens enviadas pela própria equipe (confirmações, cobranças) e conversas sem assunto definido.</p>
    </section>

    <section>
      <h3>Onde a IA pode passar a atender</h3>
      <p class="desc">Frentes que cobrem a maior parte das transferências de hoje:</p>
      <div class="insight-grid">
        ${topInsights}
      </div>
      <br/>
      <div class="highlight">Somadas, essas frentes representam até <b>${insightsTotalPct.toFixed(0)}% das conversas</b> que hoje vão para a equipe — e que a IA poderia atender de imediato.</div>
    </section>
  </main>
  <footer>
    Fonte: conversas de WhatsApp da ${data.orgName} entre ${data.startDate} e ${data.endDate} (${data.totalConversas.toLocaleString('pt-BR')} conversas, ${totalMsgs.toLocaleString('pt-BR')} mensagens). Classificação de assuntos feita a partir das mensagens do cliente imediatamente anteriores à entrada da equipe na conversa, via IA. — <b>Merkos</b>
  </footer>
</body>
</html>`;
}
