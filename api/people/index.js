// POST /api/people -> create (or upsert) a person. Body = full person object.
import { db } from '../_lib/db.js';
import { requireSession } from '../_lib/guard.js';
import { json, readJsonBody } from '../_lib/http.js';

export default async function handler(req, res) {
  const sess = await requireSession(req, res);
  if (!sess) return;
  if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }
  try {
    const p = await readJsonBody(req);
    if (!p || !p.id) return json(res, 400, { error: 'missing_id' });
    const sql = db();
    const pos = await sql`select coalesce(max(position),0)+1 as p from people`;
    await sql`insert into people (id,email,data,position) values (${p.id},${p.email || null},${JSON.stringify(p)},${pos[0].p})
              on conflict (id) do update set email=excluded.email, data=excluded.data, updated_at=now()`;
    return json(res, 200, { ok: true });
  } catch (e) {
    console.error('[people POST]', e);
    return json(res, 500, { error: 'server_error' });
  }
}
