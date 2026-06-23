// Require a valid session; otherwise respond 401 and return null.
import { readCookies, json } from './http.js';
import { verifySession, SESSION_COOKIE } from './session.js';

export async function requireSession(req, res) {
  const cookies = readCookies(req);
  const sess = await verifySession(cookies[SESSION_COOKIE]);
  if (!sess) {
    json(res, 401, { error: 'unauthorized' });
    return null;
  }
  return sess;
}
