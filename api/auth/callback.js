// GET /api/auth/callback — Google redirects here with ?code&state.
// Verify state + id_token, enforce the allowlist, set the session cookie.
// (The Google refresh_token for Calendar is persisted in the database step.)

import { oauthClient } from '../_lib/google.js';
import { isAllowed } from '../_lib/allowlist.js';
import { createSession, SESSION_COOKIE, SESSION_MAX_AGE } from '../_lib/session.js';
import { readCookies, setCookie, clearCookie, baseUrl, redirect } from '../_lib/http.js';
import { db } from '../_lib/db.js';
import { encrypt } from '../_lib/crypto.js';

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

    // Record the login and link it to a Team person by email (if one matches).
    // (tokens.refresh_token is persisted in the Calendar step.)
    try {
      const sql = db();
      const rows = await sql`select id from people where lower(email)=lower(${p.email}) limit 1`;
      const personId = rows[0]?.id || null;
      // refresh_token is only returned on consent (we force prompt=consent), so
      // keep any previously-stored token when this login doesn't include one.
      const rtEnc = tokens.refresh_token ? encrypt(tokens.refresh_token) : null;
      await sql`insert into users (google_sub,email,name,picture,person_id,refresh_token_enc,last_login_at)
                values (${p.sub},${p.email},${p.name || ''},${p.picture || ''},${personId},${rtEnc},now())
                on conflict (email) do update set google_sub=excluded.google_sub, name=excluded.name,
                  picture=excluded.picture, person_id=coalesce(users.person_id, excluded.person_id),
                  refresh_token_enc=coalesce(excluded.refresh_token_enc, users.refresh_token_enc), last_login_at=now()`;
    } catch (e) {
      console.error('[auth/callback] user upsert failed', e);
    }

    redirect(res, '/');
  } catch (e) {
    console.error('[auth/callback]', e);
    redirect(res, '/?error=auth_failed');
  }
}
