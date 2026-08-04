import type { Client } from 'pg';

export interface OrgInfo {
  id: string;
  name: string;
}

export async function getOrganization(client: Client, orgId: string): Promise<OrgInfo> {
  const r = await client.query(`SELECT id, name FROM organizations WHERE id = $1`, [orgId]);
  if (r.rows.length === 0) {
    throw new Error(`Organizacao ${orgId} nao encontrada`);
  }
  return r.rows[0];
}

export interface RoleCounts {
  USER: number;
  AGENT: number;
  HUMAN: number;
}

export async function getMessageCountsByRole(
  client: Client,
  orgId: string,
  start: string,
  end: string,
): Promise<RoleCounts> {
  const r = await client.query(
    `SELECT cm.role, COUNT(*) AS total
     FROM chat_messages cm
     JOIN chat_sessions cs ON cs.id = cm.session_id
     WHERE cs.organization_id = $1
       AND cm.created_at >= $2::date AND cm.created_at < $3::date
     GROUP BY cm.role`,
    [orgId, start, end],
  );
  const counts: RoleCounts = { USER: 0, AGENT: 0, HUMAN: 0 };
  for (const row of r.rows) {
    counts[row.role as keyof RoleCounts] = Number(row.total);
  }
  return counts;
}

export interface SessionDetail {
  sessionId: string;
  firstRole: 'USER' | 'AGENT' | 'HUMAN';
  hasHuman: boolean;
  lastUserMessages: string[];
}

// Retorna uma linha por "conversa" (sessao criada no periodo com mais de 2 mensagens),
// com o suficiente pra decidir: resolvida 100% IA, contato iniciado pela equipe,
// ou o texto das ultimas mensagens do cliente antes do humano entrar (pra classificacao).
export async function getSessionDetails(
  client: Client,
  orgId: string,
  start: string,
  end: string,
): Promise<SessionDetail[]> {
  const r = await client.query(
    `WITH conversas AS (
       SELECT cs.id
       FROM chat_sessions cs
       JOIN chat_messages cm ON cm.session_id = cs.id
       WHERE cs.organization_id = $1
         AND cs.created_at >= $2::date AND cs.created_at < $3::date
       GROUP BY cs.id
       HAVING COUNT(cm.id) > 2
     ),
     first_msg AS (
       SELECT DISTINCT ON (cm.session_id) cm.session_id, cm.role AS first_role
       FROM chat_messages cm
       JOIN conversas c ON c.id = cm.session_id
       ORDER BY cm.session_id, cm.created_at ASC
     ),
     human_flag AS (
       SELECT cm.session_id,
              bool_or(cm.role = 'HUMAN') AS has_human,
              MIN(cm.created_at) FILTER (WHERE cm.role = 'HUMAN') AS first_human_at
       FROM chat_messages cm
       JOIN conversas c ON c.id = cm.session_id
       GROUP BY cm.session_id
     )
     SELECT
       c.id AS session_id,
       fm.first_role,
       hf.has_human,
       (
         SELECT COALESCE(json_agg(t.content ORDER BY t.created_at ASC), '[]'::json)
         FROM (
           SELECT cm.content, cm.created_at
           FROM chat_messages cm
           WHERE cm.session_id = c.id
             AND cm.role = 'USER'
             AND (hf.first_human_at IS NULL OR cm.created_at < hf.first_human_at)
           ORDER BY cm.created_at DESC
           LIMIT 3
         ) t
       ) AS last_user_messages
     FROM conversas c
     JOIN first_msg fm ON fm.session_id = c.id
     JOIN human_flag hf ON hf.session_id = c.id`,
    [orgId, start, end],
  );

  return r.rows.map((row) => ({
    sessionId: String(row.session_id),
    firstRole: row.first_role,
    hasHuman: row.has_human,
    lastUserMessages: (row.last_user_messages as string[]).reverse(),
  }));
}
