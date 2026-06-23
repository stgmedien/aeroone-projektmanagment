// PATCH /api/people/:id -> replace a person (body = full person object)
import { db } from '../_lib/db.js';
import { requireSession } from '../_lib/guard.js';
import { json, readJsonBody } from '../_lib/http.js';

export default async function handler(req, res) {
  const sess = await requireSession(req, res);
  if (!sess) return;
  const id = req.query?.id;
  if (!id) return json(res, 400, { error: 'missing_id' });
  const sql = db();
  try {
    if (req.method === 'PATCH' || req.method === 'PUT') {
      const p = await readJsonBody(req);
      await sql`update people set email=${p.email || null}, data=${JSON.stringify(p)}, updated_at=now() where id=${id}`;
      return json(res, 200, { ok: true });
    }
    res.statusCode = 405;
    return res.end();
  } catch (e) {
    console.error('[people :id]', e);
    return json(res, 500, { error: 'server_error' });
  }
}
