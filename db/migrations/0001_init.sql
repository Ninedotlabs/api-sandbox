-- Universal API — initial schema.
-- Purely additive: it creates only new lowercase tables and touches nothing that
-- already exists in this database.

-- ---------------------------------------------------------------- auth (Auth.js adapter)
create table if not exists users (
  id             text primary key,
  name           text,
  email          text unique,
  email_verified timestamptz,
  image          text,
  created_at     timestamptz not null default now()
);

create table if not exists accounts (
  user_id             text not null references users(id) on delete cascade,
  type                text not null,
  provider            text not null,
  provider_account_id text not null,
  refresh_token       text,
  access_token        text,
  expires_at          bigint,
  token_type          text,
  scope               text,
  id_token            text,
  session_state       text,
  primary key (provider, provider_account_id)
);
create index if not exists accounts_user_id_idx on accounts (user_id);

create table if not exists sessions (
  session_token text primary key,
  user_id       text not null references users(id) on delete cascade,
  expires       timestamptz not null
);
create index if not exists sessions_user_id_idx on sessions (user_id);

create table if not exists verification_tokens (
  identifier text not null,
  token      text not null,
  expires    timestamptz not null,
  primary key (identifier, token)
);

-- ---------------------------------------------------------------- application
create table if not exists projects (
  id          text primary key,
  owner_id    text references users(id) on delete cascade,   -- null until auth is wired
  name        text not null,
  slug        text not null unique,
  description text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists models (
  id         text primary key,
  project_id text not null references projects(id) on delete cascade,
  name       text not null,
  position   integer not null default 0
);
-- resource names are compared case-insensitively in the app
create unique index if not exists models_project_name_lower_idx on models (project_id, lower(name));

create table if not exists fields (
  id        text primary key,
  model_id  text not null references models(id) on delete cascade,
  name      text not null,
  type      text not null check (type in ('text','number','boolean','date','email','url','choice','link','json')),
  required  boolean not null default false,
  is_unique boolean not null default false,
  options   jsonb,
  link_to   text references models(id) on delete set null,
  position  integer not null default 0
);
create unique index if not exists fields_model_name_lower_idx on fields (model_id, lower(name));

create table if not exists routes (
  id          text primary key,
  project_id  text not null references projects(id) on delete cascade,
  model_id    text references models(id) on delete cascade,
  method      text not null check (method in ('GET','POST','PUT','PATCH','DELETE')),
  path        text not null,
  action      text not null check (action in ('list','get','create','update','delete','custom')),
  description text not null default '',
  filters     jsonb not null default '[]'::jsonb,
  position    integer not null default 0,
  unique (project_id, method, path)
);

-- one row per mock record; `id` is the per-resource id the API exposes ("1", "2", ...)
create table if not exists records (
  model_id   text not null references models(id) on delete cascade,
  id         text not null,
  data       jsonb not null,
  created_at timestamptz not null default now(),
  primary key (model_id, id)
);

-- bearer tokens for the management API and the MCP server
create table if not exists api_tokens (
  id           text primary key,
  user_id      text references users(id) on delete cascade,
  name         text not null,
  token_hash   text not null unique,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);
