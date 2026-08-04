# Relatórios de Atendimento com IA — Merkos

Sistema separado e isolado da produção do Merkos, que gera relatórios de atendimento com IA por cliente, com filtro de data e cliente, publicado no GitHub Pages.

## Como funciona

- Conecta no banco de produção usando um usuário **somente leitura** (`merkos_reports_ro`), restrito às tabelas `organizations`, `chat_sessions` e `chat_messages`.
- Calcula: mensagens por papel (cliente/IA/equipe), conversas do período, quantas foram 100% resolvidas pela IA, e classifica por IA o assunto das conversas que precisaram de humano.
- Gera um HTML autocontido por relatório (`docs/relatorios/*.html`) e atualiza um índice (`docs/data/index.json`) usado pela página inicial (`docs/index.html`) para filtrar por cliente e período.
- Nunca escreve no banco de produção nem depende de nenhuma infraestrutura do repositório `merkos`.

## Gerar um novo relatório

Vá em **Actions → Gerar relatório → Run workflow** e informe:
- `org_id`: ID da organização no banco (ex: `6` = Top Sports, `2` = Talula Cablepark, `7` = CBS - Curitiba Beach Sports)
- `start_date` / `end_date`: datas no formato `YYYY-MM-DD` (inclusive)

O relatório aparece automaticamente na página inicial publicada no GitHub Pages.

## Categorias por cliente

As categorias fixas de classificação de assunto ficam em `scripts/org-config.ts`, uma lista por `organization_id`. Clientes sem lista própria usam uma lista genérica (`GENERIC_CATEGORIES` em `scripts/categories.ts`). Se a IA não conseguir encaixar uma conversa em nenhuma categoria, ela aparece como "Outros (não mapeados)" no relatório — sinal de que vale criar uma categoria nova pra esse cliente.

## Rodar localmente

```bash
npm install
PGHOST=... PGPORT=5432 PGDATABASE=postgres PGUSER=... PGPASSWORD=... OPENROUTER_API_KEY=... \
ORG_ID=6 START_DATE=2026-07-01 END_DATE=2026-07-31 \
npm run generate
```
