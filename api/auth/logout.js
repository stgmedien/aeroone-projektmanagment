// POST or GET /api/auth/logout — clear the session cookie.

import { clearCookie, json, redirect, baseUrl } from '../_lib/http.js';
import { SESSION_COOKIE } from '../_lib/session.js';

export default function handler(req, res) {
  // Only mutate session state on a same-origin POST (prevents forced-logout CSRF
  // via cross-site GET navigations under SameSite=Lax).
  if ((req.method || 'GET').toUpperCase() !== 'POST') return redirect(res, '/');
  const origin = req.headers.origin || '';
  if (origin && origin !== baseUrl(req)) return json(res, 403, { error: 'forbidden' });
  clearCookie(res, SESSION_COOKIE);
  return json(res, 200, { ok: true });
}
