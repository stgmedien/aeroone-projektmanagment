// Google OAuth 2.0 client + scopes. Calendar scope is included now so users
// consent once; the Calendar features are wired in a later step.

import { OAuth2Client } from 'google-auth-library';
import { baseUrl } from './http.js';

export const SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  // Calendar scope is added in the Calendar step:
  // 'https://www.googleapis.com/auth/calendar.events',
];

export function redirectUri(req) {
  return `${baseUrl(req)}/api/auth/callback`;
}

export function oauthClient(req) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set');
  return new OAuth2Client({ clientId, clientSecret, redirectUri: redirectUri(req) });
}
