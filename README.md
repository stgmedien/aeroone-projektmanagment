# Aero One Projektorganisationstool

Internal project-management tool for **Aero One** — Kanban boards, timeline, calendar,
capacity planning and team views for drone-media projects (real estate & architecture).

**Live:** https://aero-one-projekttool.vercel.app

## Stack

- **Frontend** — a self-contained "dc-runtime" app (`index.html` + `support.js`): an HTML
  template with a `class Component extends DCLogic` logic class, rendered by a small runtime
  that vendors React 18 locally (`/vendor`, no CDN). Networking lives in `api-client.js`.
- **Backend** — Vercel serverless functions under `/api` (Node 22, ESM).
- **Database** — Neon Postgres (EU). Entities stored as `jsonb` in the app's exact shapes.
- **Auth** — Google OAuth 2.0, signed httpOnly session cookie, email allowlist.
- **Calendar** — task deadlines sync to a shared Google Calendar (two-way).
- **Hosting** — Vercel (region `fra1`), auto-deploy on push to `main`.

## Layout

```
index.html              the app (served at /)
support.js              dc-runtime (React loaded from /vendor)
api-client.js           window.AeroAPI — talks to /api
vendor/                 pinned React / ReactDOM / Babel
assets/, uploads/       logos
api/                    serverless functions
  auth/                 Google OAuth + session
  state.js              load/seed the workspace
  tasks|boards|people/  CRUD
  calendar/sync.js      push deadlines + pull reschedules
  _lib/                 db, session, google, calendar, crypto, guard, http
db/schema.sql           tables  ·  db/migrate.js  apply schema
```

## Configuration

Environment variables (set in Vercel; see `.env.example`): `DATABASE_URL`, `SESSION_SECRET`,
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ALLOWED_EMAILS`, `TOKEN_ENC_KEY`,
`CALENDAR_SYNC_EMAIL`, and (for reminders) `BREVO_API_KEY`, `CRON_SECRET`.

## Local development

```bash
npm install
cp .env.example .env.local      # fill in values
node db/migrate.js              # apply schema (uses DATABASE_URL)
vercel dev                      # run app + functions locally
```

Deploys happen automatically when changes land on `main`.
