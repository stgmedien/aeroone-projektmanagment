// GET /api/auth/callback — Google redirects here with ?code&state.
// Verify state + id_token, enforce the allowlist, set the session cookie.
// (The Google refresh_token for Calendar is persisted in the database step.)

import { oauthClient } from '../_lib/google.js';
import { isAllowed } from '../_lib/allowlist.js';
import { createSession, SESSION_COOKIE, SESSION_MAX_AGE } from '../_lib/session.js';
import { readCookies, setCookie, clearCookie, baseUrl, redirect } from '../_lib/http.js';

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, baseUrl(req));
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const cookies = readCookies(req);

    if (!code || !state || state !== cookies.ao_oauth_state) {
      return redirect(res, '/?error=invalid_state');
    }
    clearCookie(res, 'ao_oauth_state');

    const client = oauthClient(req);
    const { tokens } = await client.getToken(code);
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const p = ticket.getPayload();

    if (!p || !p.email || !p.email_verified || !isAllowed(p.email)) {
      return redirect(res, '/?error=not_allowed');
    }

    const session = await createSession({
      sub: p.sub,
      email: p.email,
      name: p.name || '',
      picture: p.picture || '',
    });
    setCookie(res, SESSION_COOKIE, session, { maxAge: SESSION_MAX_AGE });

    // TODO (persistence step): upsert the user row and store
    // tokens.refresh_token (encrypted) for offline Google Calendar access.

    redirect(res, '/');
  } catch (e) {
    console.error('[auth/callback]', e);
    redirect(res, '/?error=auth_failed');
  }
}
