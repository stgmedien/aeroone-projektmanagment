// Google Calendar sync. Pushes task deadlines as all-day events to a shared
// "Aero One Projekte" calendar, written via one designated account's refresh
// token (CALENDAR_SYNC_EMAIL). Lean: OAuth token + Calendar REST (no heavy SDK).
// All functions are best-effort and no-op gracefully until a sync account with
// a stored refresh token exists.
import { OAuth2Client } from 'google-auth-library';
import { db } from './db.js';
import { decrypt } from './crypto.js';

const CAL = 'https://www.googleapis.com/calendar/v3';

async function accessToken() {
  const email = process.env.CALENDAR_SYNC_EMAIL;
  if (!email) return null;
  const sql = db();
  const rows = await sql`select refresh_token_enc from users where lower(email)=lower(${email}) limit 1`;
  const rt = decrypt(rows[0]?.refresh_token_enc);
  if (!rt) return null;
  const o = new OAuth2Client(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
  o.setCredentials({ refresh_token: rt });
  const { token } = await o.getAccessToken();
  return token || null;
}

async function api(token, method, path, body) {
  const r = await fetch(CAL + path, {
    method,
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) {
    const txt = await r.text();
    const e = new Error('Calendar ' + method + ' ' + r.status + ' ' + txt.slice(0, 200));
    e.status = r.status;
    throw e;
  }
  return r.status === 204 ? null : r.json();
}

async function calendarId(token) {
  const sql = db();
  const rows = await sql`select value from settings where key='calendar_id' limit 1`;
  if (rows[0]?.value) return rows[0].value;
  const created = await api(token, 'POST', '/calendars', { summary: 'Aero One Projekte', timeZone: 'Europe/Berlin' });
  await sql`insert into settings (key,value) values ('calendar_id',${created.id}) on conflict (key) do update set value=excluded.value, updated_at=now()`;
  return created.id;
}

const evPath = (calId, eventId) =>
  '/calendars/' + encodeURIComponent(calId) + '/events' + (eventId ? '/' + encodeURIComponent(eventId) : '');

function addDay(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
const colorId = (p) => (p === 'hoch' ? '11' : p === 'mittel' ? '6' : '2');

function eventBody(t, people, boards) {
  const board = (boards || []).find((b) => b.id === t.boardId);
  const assignees = (t.assignments || [])
    .map((a) => (people.find((x) => x.id === a.personId) || {}).name)
    .filter(Boolean);
  const lines = [];
  if (board) lines.push('Board: ' + board.title);
  if (assignees.length) lines.push('Team: ' + assignees.join(', '));
  lines.push('Status: ' + t.status, 'Priorität: ' + t.priority);
  return {
    summary: '📌 ' + t.title,
    description: lines.join('\n'),
    start: { date: t.deadline },
    end: { date: addDay(t.deadline) },
    colorId: colorId(t.priority),
  };
}

// Create/update/remove the calendar event for one task to match its current state.
export async function syncTaskToCalendar(taskId) {
  try {
    const token = await accessToken();
    if (!token) return;
    const sql = db();
    const rows = await sql`select google_event_id, data from tasks where id=${taskId} limit 1`;
    if (!rows[0]) return;
    const t = rows[0].data;
    const eventId = rows[0].google_event_id;

    if (!t.deadline) {
      if (eventId) {
        const calId = await calendarId(token);
        try { await api(token, 'DELETE', evPath(calId, eventId)); } catch { /* already gone */ }
        await sql`update tasks set google_event_id=null where id=${taskId}`;
      }
      return;
    }

    const [pp, bb] = await Promise.all([sql`select data from people`, sql`select data from boards`]);
    const body = eventBody(t, pp.map((r) => r.data), bb.map((r) => r.data));
    const calId = await calendarId(token);

    if (eventId) {
      try { await api(token, 'PUT', evPath(calId, eventId), body); return; }
      catch (e) { if (e.status !== 404 && e.status !== 410) throw e; }
    }
    const created = await api(token, 'POST', evPath(calId), body);
    await sql`update tasks set google_event_id=${created.id} where id=${taskId}`;
  } catch (e) {
    console.error('[calendar] syncTask', e?.message || e);
  }
}

export async function deleteEvent(eventId) {
  if (!eventId) return;
  try {
    const token = await accessToken();
    if (!token) return;
    const calId = await calendarId(token);
    await api(token, 'DELETE', evPath(calId, eventId));
  } catch (e) {
    console.error('[calendar] deleteEvent', e?.message || e);
  }
}

// Push every task with a deadline (backfill / repair).
export async function backfillAll() {
  const token = await accessToken();
  if (!token) return { synced: 0, reason: 'no_sync_account' };
  const sql = db();
  const rows = await sql`select id from tasks where deadline is not null`;
  for (const r of rows) await syncTaskToCalendar(r.id);
  return { synced: rows.length };
}

// Pull: if a synced event was moved in Google, reflect the new date on the task.
export async function reconcileFromCalendar() {
  const token = await accessToken();
  if (!token) return { pulled: 0, reason: 'no_sync_account' };
  const sql = db();
  const rows = await sql`select id, google_event_id, data from tasks where google_event_id is not null`;
  const calId = await calendarId(token);
  let pulled = 0;
  for (const row of rows) {
    try {
      const ev = await api(token, 'GET', evPath(calId, row.google_event_id));
      const evDate = ev.start && ev.start.date;
      if (evDate && evDate !== row.data.deadline) {
        const nd = { ...row.data, deadline: evDate };
        await sql`update tasks set deadline=${evDate}, data=${JSON.stringify(nd)}, updated_at=now() where id=${row.id}`;
        pulled++;
      }
    } catch { /* event removed in Google — leave the task as-is */ }
  }
  return { pulled };
}
