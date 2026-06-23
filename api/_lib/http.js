// Small HTTP helpers shared by the serverless functions (Node runtime, ESM).

export function readCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  header.split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i > 0) {
      const k = part.slice(0, i).trim();
      const v = part.slice(i + 1).trim();
      if (k) out[k] = decodeURIComponent(v);
    }
  });
  return out;
}

export function setCookie(res, name, value, opts = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${opts.path || '/'}`);
  if (opts.maxAge != null) parts.push(`Max-Age=${opts.maxAge}`);
  parts.push(`SameSite=${opts.sameSite || 'Lax'}`);
  if (opts.httpOnly !== false) parts.push('HttpOnly');
  if (opts.secure !== false) parts.push('Secure');
  const prev = res.getHeader('Set-Cookie');
  const arr = prev ? (Array.isArray(prev) ? prev.slice() : [prev]) : [];
  arr.push(parts.join('; '));
  res.setHeader('Set-Cookie', arr);
}

export function clearCookie(res, name) {
  setCookie(res, name, '', { maxAge: 0 });
}

// Public base URL of the deployment. Prefer APP_BASE_URL so the OAuth redirect
// URI is always one of the values registered in Google, regardless of which
// Vercel alias served the request.
export function baseUrl(req) {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/+$/, '');
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

export function json(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

export function redirect(res, location, status = 302) {
  res.statusCode = status;
  res.setHeader('Location', location);
  res.end();
}

// Vercel's Node runtime usually parses JSON bodies into req.body, but fall back
// to reading the stream for robustness. Caps the body size to avoid buffering
// arbitrarily large requests.
const MAX_BODY = 256 * 1024; // 256 KB
function tooLarge() {
  const e = new Error('payload_too_large');
  e.tooLarge = true;
  return e;
}
export async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    if (req.body.length > MAX_BODY) throw tooLarge();
    if (!req.body.length) return {};
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  const chunks = [];
  let total = 0;
  for await (const c of req) {
    total += c.length;
    if (total > MAX_BODY) throw tooLarge();
    chunks.push(c);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return {}; }
}
