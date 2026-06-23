// POST /api/boards -> create (or upsert) a board. Body = full board object.
import { db } from '../_lib/db.js';
import { requireSession } from '../_lib/guard.js';
import { json, readJsonBody } from '../_lib/http.js';

export default async function handler(req, res) {
  const sess = await requireSession(req, res);
  if (!sess) return;
  if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }
  try {
    const b = await readJsonBody(req);
    if (!b || !b.id) return json(res, 400, { error: 'missing_id' });
    const sql = db();
    const pos = await sql`select coalesce(max(position),0)+1 as p from boards`;
    await sql`insert into boards (id,data,position) values (${b.id},${JSON.stringify(b)},${pos[0].p})
              on conflict (id) do update set data=excluded.data, updated_at=now()`;
    return json(res, 200, { ok: true });
  } catch (e) {
    console.error('[boards POST]', e);
    return json(res, 500, { error: 'server_error' });
  }
}
