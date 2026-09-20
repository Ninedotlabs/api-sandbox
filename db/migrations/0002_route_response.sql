-- `Route` gains an optional `response` (custom response shapes design,
-- docs/superpowers/specs/2026-09-20-response-shapes-design.md §2). Nullable and additive:
-- every existing row defaults to null, which the app already reads as "today's behaviour".
alter table routes add column if not exists response jsonb;
