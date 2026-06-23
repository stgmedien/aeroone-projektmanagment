// PATCH /api/tasks/:id  -> replace a task (body = full task object)
// DELETE /api/tasks/:id -> remove a task
import { db } from '../_lib/db.js';
import { requireSession } from '../_lib/guard.js';
import { json, readJsonBody } from '../_lib/http.js';
import { validDeadline } from '../_lib/validate.js';
import { syncTaskToCalendar, deleteEvent } from '../_lib/calendar.js';

export default async function handler(req, res) {
  const sess = await requireSession(req, res);
  if (!sess) return;
  const id = req.query?.id;
  if (!id) return json(res, 400, { error: 'missing_id' });
  const sql = db();
  try {
    if (req.method === 'PATCH' || req.method === 'PUT') {
      const t = await readJsonBody(req);
      t.deadline = validDeadline(t.deadline);
      await sql`update tasks set board_id=${t.boardId || null}, deadline=${t.deadline}, data=${JSON.stringify(t)}, updated_at=now() where id=${id}`;
      await syncTaskToCalendar(id);
      return json(res, 200, { ok: true });
    }
    if (req.method === 'DELETE') {
      const ex = await sql`select google_event_id from tasks where id=${id} limit 1`;
      await sql`delete from tasks where id=${id}`;
      if (ex[0]?.google_event_id) await deleteEvent(ex[0].google_event_id);
      return json(res, 200, { ok: true });
    }
    res.statusCode = 405;
    return res.end();
  } catch (e) {
    console.error('[tasks :id]', e);
    return json(res, 500, { error: 'server_error' });
  }
}
