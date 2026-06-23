// GET /api/cron/reminders — runs daily (Vercel Cron). Also callable manually by
// a logged-in user for testing. Two jobs:
//   1) Calendar reconcile (pull event reschedules back to tasks); ?backfill=1 also pushes all.
//   2) Deadline reminders: email/SMS each assignee about tasks due within their window,
//      de-duplicated via reminder_log so nobody is pinged twice for the same task.
import { db } from '../_lib/db.js';
import { json, readCookies } from '../_lib/http.js';
import { verifySession, SESSION_COOKIE } from '../_lib/session.js';
import { sendEmail, sendSms, brevoConfigured } from '../_lib/brevo.js';
import { reconcileFromCalendar, backfillAll } from '../_lib/calendar.js';

const APP_URL = 'https://aero-one-projekttool.vercel.app/';

const dayNum = (s) => Math.floor(new Date(s + 'T00:00:00Z').getTime() / 86400000);
const berlinToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());
function normPhone(s) {
  let x = (s || '').replace(/[^\d+]/g, '');
  if (x.startsWith('00')) x = '+' + x.slice(2);
  if (!x.startsWith('+')) return null;
  return x.length >= 8 ? x : null;
}
const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function emailFor(t, p) {
  return {
    to: p.email,
    name: p.name,
    subject: '⏰ Deadline-Erinnerung: ' + t.title,
    html:
      `<div style="font-family:Arial,sans-serif;color:#1A1714">` +
      `<h2 style="color:#C96B2E">Hallo ${esc(p.name)},</h2>` +
      `<p>Eine deiner Aufgaben wird bald fällig:</p>` +
      `<p style="font-size:18px;font-weight:bold">${esc(t.title)}</p>` +
      `<p>📅 Deadline: <b>${esc(t.deadline)}</b><br>🏷️ Priorität: ${esc(t.priority)}<br>📌 Status: ${esc(t.status)}</p>` +
      (t.desc ? `<p>${esc(t.desc)}</p>` : '') +
      `<p><a href="${APP_URL}" style="background:#C96B2E;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Im Aero One Projekttool öffnen →</a></p>` +
      `<hr style="border:none;border-top:1px solid #eee"><p style="color:#999;font-size:12px">Automatische Deadline-Erinnerung · Aero One · Brevo</p></div>`,
  };
}
const smsFor = (t) => `Aero One: "${t.title}" ist am ${t.deadline} faellig (Prio ${t.priority}). ${APP_URL}`;

export default async function handler(req, res) {
  // Auth: Vercel cron Bearer secret, or a logged-in session (manual run).
  const secret = process.env.CRON_SECRET;
  let ok = !!secret && (req.headers.authorization || '') === 'Bearer ' + secret;
  if (!ok) ok = !!(await verifySession(readCookies(req)[SESSION_COOKIE]));
  if (!ok) return json(res, 401, { error: 'unauthorized' });

  const url = new URL(req.url, 'http://x');
  const out = { calendar: {}, reminders: { email: 0, sms: 0, candidates: 0, brevo: brevoConfigured() } };
  const sql = db();

  // 1) Calendar reconcile (and optional full backfill).
  try {
    if (url.searchParams.get('backfill') === '1') out.calendar.push = await backfillAll();
    out.calendar.pull = await reconcileFromCalendar();
  } catch (e) {
    console.error('[cron] calendar', e?.message || e);
  }

  // 2) Deadline reminders.
  try {
    const [taskRows, peopleRows] = await Promise.all([
      sql`select data from tasks where deadline is not null`,
      sql`select data from people`,
    ]);
    const peopleById = {};
    peopleRows.forEach((r) => { peopleById[r.data.id] = r.data; });
    const today = berlinToday();

    for (const row of taskRows) {
      const t = row.data;
      if (t.status === 'done') continue;
      const rem = t.reminders || {};
      if (!rem.email && !rem.sms) continue;
      const daysUntil = dayNum(t.deadline) - dayNum(today);
      const windowDays = Math.max(1, Math.round((rem.hoursBefore || 24) / 24));
      if (daysUntil < 0 || daysUntil > windowDays) continue;

      const assignees = (t.assignments || []).map((a) => peopleById[a.personId]).filter(Boolean);
      for (const p of assignees) {
        out.reminders.candidates++;
        if (rem.email && p.email && brevoConfigured()) {
          const seen = await sql`select 1 from reminder_log where task_id=${t.id} and channel='email' and recipient=${p.email} limit 1`;
          if (!seen.length) {
            try {
              await sendEmail(emailFor(t, p));
              await sql`insert into reminder_log (task_id,channel,hours_before,recipient) values (${t.id},'email',${rem.hoursBefore || null},${p.email})`;
              out.reminders.email++;
            } catch (e) { console.error('[cron] email', e?.message || e); }
          }
        }
        const phone = normPhone(p.phone);
        if (rem.sms && phone && brevoConfigured()) {
          const seen = await sql`select 1 from reminder_log where task_id=${t.id} and channel='sms' and recipient=${phone} limit 1`;
          if (!seen.length) {
            try {
              await sendSms({ to: phone, text: smsFor(t) });
              await sql`insert into reminder_log (task_id,channel,hours_before,recipient) values (${t.id},'sms',${rem.hoursBefore || null},${phone})`;
              out.reminders.sms++;
            } catch (e) { console.error('[cron] sms', e?.message || e); }
          }
        }
        // WhatsApp: not supported via Brevo transactional API in this version.
      }
    }
  } catch (e) {
    console.error('[cron] reminders', e?.message || e);
    return json(res, 500, { error: 'cron_failed', message: String(e?.message || e), partial: out });
  }

  return json(res, 200, { ok: true, ...out });
}
