// GET /api/auth/me — returns the current session (or {authed:false}).
// The frontend uses this on load to decide whether to show the login screen,
// and maps the email to a Team person for currentUserId.

import { readCookies, json } from '../_lib/http.js';
import { verifySession, SESSION_COOKIE } from '../_lib/session.js';
import { db } from '../_lib/db.js';

export default async function handler(req, res) {
  const cookies = readCookies(req);
  const sess = await verifySession(cookies[SESSION_COOKIE]);
  if (!sess) return json(res, 200, { authed: false });

  // Which Team person is this account? (users.person_id, else match by email)
  let personId = null;
  try {
    const sql = db();
    const u = await sql`select person_id from users where lower(email)=lower(${sess.email}) limit 1`;
    personId = u[0]?.person_id || null;
    if (!personId) {
      const p = await sql`select id from people where lower(email)=lower(${sess.email}) limit 1`;
      personId = p[0]?.id || null;
    }
  } catch (e) {
    /* DB optional for identity; leave personId null */
  }

  return json(res, 200, {
    authed: true,
    personId,
    user: { sub: sess.sub, email: sess.email, name: sess.name, picture: sess.picture },
  });
}
