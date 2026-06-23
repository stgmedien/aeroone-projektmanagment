// Require a valid session AND that the account is still authorized on every
// request (re-checks the allowlist / Team membership, not just at login).
import { readCookies, json } from './http.js';
import { verifySession, SESSION_COOKIE } from './session.js';
import { isAllowedAsync } from './allowlist.js';

export async function requireSession(req, res) {
  const cookies = readCookies(req);
  const sess = await verifySession(cookies[SESSION_COOKIE]);
  if (!sess) {
    json(res, 401, { error: 'unauthorized' });
    return null;
  }
  if (!(await isAllowedAsync(sess.email))) {
    json(res, 403, { error: 'forbidden' });
    return null;
  }
  return sess;
}
