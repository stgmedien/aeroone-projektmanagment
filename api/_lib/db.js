// Neon serverless (HTTP) client — ideal for Vercel functions. Tagged-template
// queries are automatically parameterized.
import { neon } from '@neondatabase/serverless';

let _sql;
export function db() {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL not set');
    _sql = neon(url);
  }
  return _sql;
}
