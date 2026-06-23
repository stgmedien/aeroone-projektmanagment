// Access control: only emails on the allowlist may sign in.
// ALLOWED_EMAILS is a comma-separated list of full emails and/or "@domain" suffixes.
// Fails closed: if the list is empty/unset, nobody is allowed.

export function allowedList() {
  return String(process.env.ALLOWED_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowed(email) {
  if (!email) return false;
  const list = allowedList();
  if (list.length === 0) return false;
  const e = email.toLowerCase();
  return list.some((item) => (item.startsWith('@') ? e.endsWith(item) : e === item));
}
