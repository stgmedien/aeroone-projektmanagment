// Access control. An email is allowed if it is on the static ALLOWED_EMAILS env
// list (comma-separated full emails and/or "@domain" suffixes) OR it belongs to
// a current Team member (a row in `people`). The latter makes onboarding a single
// step (add the person → they're authorized) and makes off-boarding effective
// (remove the person / email → access is denied on the next request).
// Fails closed: with no env list and no matching person, nobody is allowed.
import { db } from './db.js';

export function allowedList() {
  return String(process.env.ALLOWED_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

// Synchronous: env allowlist only.
export function isAllowed(email) {
  if (!email) return false;
  const list = allowedList();
  if (list.length === 0) return false;
  const e = email.toLowerCase();
  return list.some((item) => (item.startsWith('@') ? e.endsWith(item) : e === item));
}

// Full check: env allowlist OR a matching Team person. Used on every request.
export async function isAllowedAsync(email) {
  if (!email) return false;
  if (isAllowed(email)) return true;
  try {
    const sql = db();
    const r = await sql`select 1 from people where lower(email)=lower(${email}) limit 1`;
    return r.length > 0;
  } catch {
    return false;
  }
}
