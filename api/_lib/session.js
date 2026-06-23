// Signed, httpOnly session cookie (stateless JWT via jose).

import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'ao_session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const encoder = new TextEncoder();

function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET is not set');
  return encoder.encode(secret);
}

export async function createSession(payload, maxAgeSec = SESSION_MAX_AGE) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${maxAgeSec}s`)
    .sign(key());
}

export async function verifySession(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    return payload;
  } catch {
    return null;
  }
}
