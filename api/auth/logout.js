// POST or GET /api/auth/logout — clear the session cookie.

import { clearCookie, json, redirect } from '../_lib/http.js';
import { SESSION_COOKIE } from '../_lib/session.js';

export default function handler(req, res) {
  clearCookie(res, SESSION_COOKIE);
  if ((req.method || 'GET').toUpperCase() === 'GET') return redirect(res, '/');
  return json(res, 200, { ok: true });
}
