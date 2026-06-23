// POST /api/calendar/sync -> push all task deadlines to Google Calendar and
// pull back any event reschedules. Session-protected; safe to call repeatedly.
import { requireSession } from '../_lib/guard.js';
import { json } from '../_lib/http.js';
import { backfillAll, reconcileFromCalendar } from '../_lib/calendar.js';

export default async function handler(req, res) {
  const sess = await requireSession(req, res);
  if (!sess) return;
  try {
    const push = await backfillAll();
    const pull = await reconcileFromCalendar();
    return json(res, 200, { ok: true, push, pull });
  } catch (e) {
    console.error('[calendar/sync]', e);
    return json(res, 500, { error: 'sync_failed', message: String((e && e.message) || e) });
  }
}
