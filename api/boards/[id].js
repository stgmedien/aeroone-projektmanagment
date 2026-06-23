// PATCH  /api/boards/:id -> replace a board (body = full board object)
// DELETE /api/boards/:id -> remove a board and all its tasks
import { db } from '../_lib/db.js';
import { requireSession } from '../_lib/guard.js';
import { json, readJsonBody } from '../_lib/http.js';
import { deleteEvent } from '../_lib/calendar.js';

export default async function handler(req, res) {
  const sess = await requireSession(req, res);
  if (!sess) return;
  const id = req.query?.id;
  if (!id) return json(res, 400, { error: 'missing_id' });
  const sql = db();
  try {
    if (req.method === 'PATCH' || req.method === 'PUT') {
      const b = await readJsonBody(req);
      await sql`update boards set data=${JSON.stringify(b)}, updated_at=now() where id=${id}`;
      return json(res, 200, { ok: true });
    }
    if (req.method === 'DELETE') {
      const evs = await sql`select google_event_id from tasks where board_id=${id} and google_event_id is not null`;
      await sql`delete from tasks where board_id=${id}`;
      await sql`delete from boards where id=${id}`;
      for (const e of evs) await deleteEvent(e.google_event_id);
      return json(res, 200, { ok: true });
    }
    res.statusCode = 405;
    return res.end();
  } catch (e) {
    console.error('[boards :id]', e);
    return json(res, 500, { error: 'server_error' });
  }
}
