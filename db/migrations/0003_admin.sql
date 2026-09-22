-- Admin role and activity log (docs/superpowers/specs/2026-09-22-admin-dashboard-design.md §1).
-- Additive only: one new column with a default, one new table.

alter table users add column if not exists role text not null default 'user';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'users_role_check') then
    alter table users add constraint users_role_check check (role in ('user', 'admin'));
  end if;
end $$;

create table if not exists activity_events (
  id            text primary key,
  actor_user_id text references users(id) on delete set null,
  -- a snapshot, so the log still reads after the account is deleted
  actor_email   text,
  action        text not null,
  target_type   text,
  target_id     text,
  -- no foreign key: the project may be deleted later and its history must survive
  project_id    text,
  channel       text not null check (channel in ('ui', 'api', 'mcp', 'auth')),
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists activity_events_created_at_idx on activity_events (created_at desc);
create index if not exists activity_events_actor_idx on activity_events (actor_user_id, created_at desc);

-- Bootstrap the first admin if they've already signed in. `ADMIN_EMAILS` covers the case
-- where they haven't yet.
update users set role = 'admin' where lower(email) = 'mohithingorani2003@gmail.com';
