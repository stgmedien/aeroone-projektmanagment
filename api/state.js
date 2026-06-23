// GET  /api/state  -> { people, boards, tasks, empty, serverTime }  (full workspace)
// POST /api/state  -> seed the DB from the app's in-memory seed, only if empty
import { db } from './_lib/db.js';
import { requireSession } from './_lib/guard.js';
import { json, readJsonBody } from './_lib/http.js';
import { validDeadline } from './_lib/validate.js';

export default async function handler(req, res) {
  const sess = await requireSession(req, res);
  if (!sess) return;
  const sql = db();
  try {
    if (req.method === 'GET') {
      const [people, boards, tasks] = await Promise.all([
        sql`select data from people order by position, id`,
        sql`select data from boards order by position, id`,
        sql`select data from tasks  order by position, id`,
      ]);
      return json(res, 200, {
        people: people.map((r) => r.data),
        boards: boards.map((r) => r.data),
        tasks: tasks.map((r) => r.data),
        empty: people.length === 0 && boards.length === 0 && tasks.length === 0,
        serverTime: Date.now(),
      });
    }

    if (req.method === 'POST') {
      const body = (await readJsonBody(req)) || {};
      const cnt = await sql`select (select count(*) from boards) + (select count(*) from people) + (select count(*) from tasks) as n`;
      if (Number(cnt[0].n) > 0) return json(res, 200, { seeded: false, reason: 'not_empty' });

      const { people = [], boards = [], tasks = [] } = body;
      for (let i = 0; i < people.length; i++) {
        const p = people[i];
        await sql`insert into people (id,email,data,position) values (${p.id},${p.email || null},${JSON.stringify(p)},${i}) on conflict (id) do nothing`;
      }
      for (let i = 0; i < boards.length; i++) {
        const b = boards[i];
        await sql`insert into boards (id,data,position) values (${b.id},${JSON.stringify(b)},${i}) on conflict (id) do nothing`;
      }
      for (let i = 0; i < tasks.length; i++) {
        const t = tasks[i];
        t.deadline = validDeadline(t.deadline);
        await sql`insert into tasks (id,board_id,deadline,data,position) values (${t.id},${t.boardId || null},${t.deadline},${JSON.stringify(t)},${i}) on conflict (id) do nothing`;
      }
      return json(res, 200, { seeded: true });
    }

    res.statusCode = 405;
    return res.end();
  } catch (e) {
    console.error('[state]', e);
    return json(res, 500, { error: 'server_error' });
  }
}
