// POST /api/tasks  -> create (or upsert) a task. Body = full task object.
import { db } from '../_lib/db.js';
import { requireSession } from '../_lib/guard.js';
import { json, readJsonBody } from '../_lib/http.js';
import { validDeadline } from '../_lib/validate.js';
import { syncTaskToCalendar } from '../_lib/calendar.js';

export default async function handler(req, res) {
  const sess = await requireSession(req, res);
  if (!sess) return;
  if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }
  try {
    const t = await readJsonBody(req);
    if (!t || !t.id) return json(res, 400, { error: 'missing_id' });
    t.deadline = validDeadline(t.deadline);
    const sql = db();
    const pos = await sql`select coalesce(max(position),0)+1 as p from tasks`;
    await sql`insert into tasks (id,board_id,deadline,data,position)
              values (${t.id},${t.boardId || null},${t.deadline},${JSON.stringify(t)},${pos[0].p})
              on conflict (id) do update set board_id=excluded.board_id, deadline=excluded.deadline, data=excluded.data, updated_at=now()`;
    await syncTaskToCalendar(t.id);
    return json(res, 200, { ok: true });
  } catch (e) {
    console.error('[tasks POST]', e);
    return json(res, 500, { error: 'server_error' });
  }
}
