-- A project can choose its icon. Nullable on purpose: a null means "never chosen", and the
-- app derives a stable icon from the slug instead, so every existing project has a face
-- the moment this ships without a backfill.

alter table projects add column if not exists icon text;
