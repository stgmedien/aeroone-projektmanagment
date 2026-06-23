// GET /api/auth/google — start the OAuth flow: set a CSRF state cookie and
// redirect to Google's consent screen.

import crypto from 'node:crypto';
import { oauthClient, SCOPES } from '../_lib/google.js';
import { setCookie, redirect } from '../_lib/http.js';

export default function handler(req, res) {
  try {
    const client = oauthClient(req);
    const state = crypto.randomBytes(16).toString('hex');
    setCookie(res, 'ao_oauth_state', state, { maxAge: 600, sameSite: 'Lax' });
    const url = client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: true,
      scope: SCOPES,
      state,
    });
    redirect(res, url);
  } catch (e) {
    console.error('[auth/google]', e);
    redirect(res, '/?error=auth_config');
  }
}
