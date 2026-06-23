// Upsert Team members (people) from JSON — idempotent. Each member maps to a
// login by email, appears in the app, and receives deadline reminders.
// Usage:
//   DATABASE_URL=... node db/set-team.js team.json
//   DATABASE_URL=... node db/set-team.js '[{"name":"Lena","email":"lena@x.de","role":"Pilotin","capacity":32,"phone":"+49 151 ...","organizer":false}]'
import pg from 'pg';
import { readFileSync } from 'node:fs';

const arg = process.argv[2];
if (!arg) { console.error('usage: node db/set-team.js <team.json | json-string>'); process.exit(1); }
const team = JSON.parse(arg.trim().startsWith('[') ? arg : readFileSync(arg, 'utf8'));

const COLORS = ['#C96B2E', '#D98324', '#B0512A', '#E0813F', '#C2410C', '#A85A2A', '#8A5A12', '#4E9A5B'];
const slug = (e) => 'p_' + String(e).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  let i = 0;
  for (const m of team) {
    if (!m.email || !m.name) { console.warn('skip (need name+email):', JSON.stringify(m)); continue; }
    const id = m.id || slug(m.email);
    const person = {
      id,
      name: String(m.name).trim(),
      role: m.role || 'Team',
      capacity: Number(m.capacity) || 40,
      email: String(m.email).trim(),
      phone: m.phone || '',
      color: m.color || COLORS[i % COLORS.length],
      organizer: !!m.organizer,
    };
    await client.query(
      `insert into people (id,email,data,position)
       values ($1,$2,$3,
         coalesce((select position from people where id=$1),
                  (select coalesce(max(position),0)+1 from people)))
       on conflict (id) do update set email=excluded.email, data=excluded.data, updated_at=now()`,
      [id, person.email, JSON.stringify(person)]
    );
    console.log('upserted', id, '·', person.name, '<' + person.email + '>', person.organizer ? '(organizer)' : '');
    i++;
  }
  const { rows } = await client.query('select count(*)::int n from people');
  console.log('people total now:', rows[0].n);
} finally {
  await client.end();
}
