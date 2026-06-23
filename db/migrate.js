// Applies db/schema.sql to the Neon database in DATABASE_URL (idempotent).
// Usage: DATABASE_URL=... node db/migrate.js
// Uses pg (direct connection) — the serverless API uses the neon HTTP driver.
import pg from 'pg';
import { readFileSync } from 'node:fs';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const ddl = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
const client = new pg.Client({ connectionString: url });

await client.connect();
try {
  await client.query(ddl); // multi-statement DDL via simple query protocol
  const { rows } = await client.query(
    "select table_name from information_schema.tables where table_schema='public' order by table_name"
  );
  console.log('migration complete. tables:', rows.map((r) => r.table_name).join(', '));
} finally {
  await client.end();
}
