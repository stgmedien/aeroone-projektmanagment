// Tiny input-validation helpers shared by the write endpoints.

// Accept only a real ISO calendar date (YYYY-MM-DD); anything else -> null.
export function validDeadline(v) {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))
    ? v
    : null;
}

export function clampInt(v, min, max, dflt) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return dflt;
  return Math.max(min, Math.min(max, n));
}
