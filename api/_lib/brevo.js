// Brevo transactional email + SMS. No-ops loudly if BREVO_API_KEY is unset.
const BREVO = 'https://api.brevo.com/v3';

export function brevoConfigured() {
  return !!process.env.BREVO_API_KEY;
}

async function call(path, body) {
  const k = process.env.BREVO_API_KEY;
  if (!k) throw new Error('BREVO_API_KEY not set');
  const r = await fetch(BREVO + path, {
    method: 'POST',
    headers: { 'api-key': k, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error('Brevo ' + path + ' ' + r.status + ' ' + t.slice(0, 200));
  }
  return r.json().catch(() => ({}));
}

export function sendEmail({ to, name, subject, html }) {
  return call('/smtp/email', {
    sender: { name: process.env.BREVO_SENDER_NAME || 'Aero One', email: process.env.BREVO_SENDER_EMAIL },
    to: [{ email: to, name: name || to }],
    subject,
    htmlContent: html,
  });
}

export function sendSms({ to, text }) {
  return call('/transactionalSMS/sms', {
    sender: (process.env.BREVO_SMS_SENDER || 'AeroOne').slice(0, 11),
    recipient: to,
    content: text,
    type: 'transactional',
  });
}
