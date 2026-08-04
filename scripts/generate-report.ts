import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createClient } from './db.js';
import { getOrganization, getMessageCountsByRole, getSessionDetails } from './queries.js';
import { classifySessions } from './classify.js';
import { renderReport } from './render.js';
import { CONTATO_EQUIPE, SAUDACOES_OUTROS, STARRED } from './categories.js';
import { getCategoriesForOrg, getInsightsForOrg } from './org-config.js';

const MONTHS_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function formatDateBR(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function periodLabel(start: string, end: string): string {
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  if (sy === ey && sm === em) {
    return `${sd} a ${ed} de ${MONTHS_PT[sm - 1]} de ${sy}`;
  }
  return `${sd} de ${MONTHS_PT[sm - 1]} de ${sy} a ${ed} de ${MONTHS_PT[em - 1]} de ${ey}`;
}

function totalDaysBetween(start: string, end: string): number {
  const s = new Date(start + 'T00:00:00Z');
  const e = new Date(end + 'T00:00:00Z');
  return Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const orgId = process.env.ORG_ID;
  const startDate = process.env.START_DATE; // inclusive, YYYY-MM-DD
  const endDate = process.env.END_DATE; // inclusive, YYYY-MM-DD

  if (!orgId || !startDate || !endDate) {
    throw new Error('Defina ORG_ID, START_DATE e END_DATE (YYYY-MM-DD)');
  }

  const endExclusive = addDays(endDate, 1);

  const client = createClient();
  await client.connect();
  await client.query(`SET TIME ZONE 'America/Sao_Paulo'`);

  console.log(`Buscando organizacao ${orgId}...`);
  const org = await getOrganization(client, orgId);

  console.log('Contando mensagens por papel...');
  const messages = await getMessageCountsByRole(client, orgId, startDate, endExclusive);

  console.log('Buscando conversas do periodo...');
  const sessions = await getSessionDetails(client, orgId, startDate, endExclusive);

  await client.end();

  const categories = getCategoriesForOrg(orgId);
  const insights = getInsightsForOrg(orgId);

  const needsClassification = sessions.filter(
    (s) => s.hasHuman && s.firstRole !== 'HUMAN' && s.lastUserMessages.length > 0,
  );

  console.log(`Classificando ${needsClassification.length} conversas via IA...`);
  const classified = await classifySessions(needsClassification, categories, org.name);

  const categoryCountsMap = new Map<string, number>();
  let resolvidaIa = 0;
  let comHumano = 0;

  for (const s of sessions) {
    if (!s.hasHuman) {
      resolvidaIa++;
      continue;
    }
    comHumano++;

    let category: string;
    if (s.firstRole === 'HUMAN') {
      category = CONTATO_EQUIPE;
    } else if (s.lastUserMessages.length === 0) {
      category = SAUDACOES_OUTROS;
    } else {
      category = classified.get(s.sessionId) ?? SAUDACOES_OUTROS;
    }

    categoryCountsMap.set(category, (categoryCountsMap.get(category) ?? 0) + 1);
  }

  const categoryCounts = Array.from(categoryCountsMap.entries()).map(([category, count]) => ({
    category,
    count,
  }));

  const reportData = {
    orgName: org.name,
    periodLabel: periodLabel(startDate, endDate),
    startDate: formatDateBR(startDate),
    endDate: formatDateBR(endDate),
    totalDays: totalDaysBetween(startDate, endDate),
    messages,
    totalConversas: sessions.length,
    resolvidaIa,
    comHumano,
    categoryCounts,
    totalMessagesForSource: messages.USER + messages.AGENT + messages.HUMAN,
    insights,
  };

  const html = renderReport(reportData);

  const orgSlug = slugify(org.name);
  const fileName = `${orgSlug}-${startDate}-a-${endDate}.html`;
  const outDir = path.join(process.cwd(), 'docs', 'relatorios');
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, fileName);
  writeFileSync(outPath, html, 'utf-8');
  console.log(`Relatorio gerado em docs/relatorios/${fileName}`);

  // Dados crus (pra pagina indice renderizar direto via JS, sem recarregar)
  const dataFileName = `${orgSlug}-${startDate}-a-${endDate}.json`;
  const dataOutDir = path.join(process.cwd(), 'docs', 'data', 'reports');
  mkdirSync(dataOutDir, { recursive: true });
  writeFileSync(
    path.join(dataOutDir, dataFileName),
    JSON.stringify(
      {
        ...reportData,
        categoryCounts: categoryCounts.map((c) => ({
          ...c,
          starred: STARRED.has(c.category),
        })),
      },
      null,
      2,
    ),
    'utf-8',
  );
  console.log(`Dados salvos em docs/data/reports/${dataFileName}`);

  // Atualiza indice de relatorios (docs/data/index.json)
  const indexPath = path.join(process.cwd(), 'docs', 'data', 'index.json');
  mkdirSync(path.dirname(indexPath), { recursive: true });
  type IndexEntry = {
    org: string;
    orgSlug: string;
    startDate: string;
    endDate: string;
    periodLabel: string;
    file: string;
    dataFile: string;
    generatedAt: string;
  };
  let index: IndexEntry[] = [];
  if (existsSync(indexPath)) {
    index = JSON.parse(readFileSync(indexPath, 'utf-8'));
  }
  index = index.filter(
    (e) => !(e.orgSlug === orgSlug && e.startDate === startDate && e.endDate === endDate),
  );
  index.push({
    org: org.name,
    orgSlug,
    startDate,
    endDate,
    periodLabel: periodLabel(startDate, endDate),
    file: `relatorios/${fileName}`,
    dataFile: `data/reports/${dataFileName}`,
    generatedAt: new Date().toISOString(),
  });
  index.sort((a, b) => (a.startDate < b.startDate ? 1 : -1));
  writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');
  console.log('Indice atualizado em docs/data/index.json');
}

main().catch((err) => {
  console.error('ERRO:', err.message);
  process.exit(1);
});
