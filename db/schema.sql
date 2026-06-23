-- Aero One Projekttool — schema (idempotent).
-- Design: a few queryable columns + a `data` jsonb that stores each entity in
-- the app's exact shape, so the dc-runtime app keeps its data model unchanged.

create table if not exists people (
  id         text primary key,
  email      text,
  data       jsonb not null default '{}'::jsonb,
  position   integer not null default 0,
  updated_at timestamptz not null default now()
);
create index if not exists people_email_idx on people (lower(email));

create table if not exists boards (
  id         text primary key,
  position   integer not null default 0,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists tasks (
  id               text primary key,
  board_id         text,
  deadline         date,
  data             jsonb not null default '{}'::jsonb,
  google_event_id  text,
  last_reminder_at timestamptz,
  position         integer not null default 0,
  updated_at       timestamptz not null default now()
);
create index if not exists tasks_board_idx on tasks (board_id);
create index if not exists tasks_deadline_idx on tasks (deadline);

-- Login accounts, mapped to a Team person by email.
create table if not exists users (
  id                uuid primary key default gen_random_uuid(),
  google_sub        text unique,
  email             text unique not null,
  name              text not null default '',
  picture           text not null default '',
  person_id         text references people(id) on delete set null,
  refresh_token_enc text,
  created_at        timestamptz not null default now(),
  last_login_at     timestamptz
);

-- Dedupe guard for the Brevo reminder cron (added in the Brevo step).
create table if not exists reminder_log (
  id           bigint generated always as identity primary key,
  task_id      text not null,
  channel      text not null,
  hours_before integer,
  recipient    text,
  sent_at      timestamptz not null default now()
);
create index if not exists reminder_log_task_idx on reminder_log (task_id);
