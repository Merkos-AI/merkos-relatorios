import { Client } from 'pg';

export function createClient(): Client {
  const required = ['PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER', 'PGPASSWORD'];
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Variavel de ambiente ausente: ${key}`);
    }
  }

  return new Client({
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT),
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    ssl: { rejectUnauthorized: false },
  });
}
