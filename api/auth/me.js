// GET /api/auth/me — returns the current session (or {authed:false}).
// The frontend uses this on load to decide whether to show the login screen,
// and maps the email to a Team person for currentUserId.

import { readCookies, json } from '../_lib/http.js';
import { verifySession, SESSION_COOKIE } from '../_lib/session.js';

export default async function handler(req, res) {
  const cookies = readCookies(req);
  const sess = await verifySession(cookies[SESSION_COOKIE]);
  if (!sess) return json(res, 200, { authed: false });
  return json(res, 200, {
    authed: true,
    user: { sub: sess.sub, email: sess.email, name: sess.name, picture: sess.picture },
  });
}
