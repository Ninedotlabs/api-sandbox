# Roadmap decisions — 2026-09-20

Recorded so they survive a context reset. Each line is a user decision unless marked Ruling.

## Queue (in order)

1. **AI edit** — plan `docs/superpowers/plans/2026-09-20-ai-edit.md`, IN EXECUTION (SDD, 4 tasks).
2. **Right-click context menus** — spec `docs/superpowers/specs/2026-09-20-context-menus-design.md`, awaiting user review.
3. **MCP stack** — four sub-projects, specs not yet written:
   1. Server-side persistence (Neon Postgres behind the existing `src/lib/services` seam)
   2. Management REST API (`/api/v1/...`) covering every feature
   3. MCP server (stdio + HTTP/SSE)
   4. MCP docs page on the website

## Context menus

- Surfaces: project rows, rail tree items, console/response, page background (all four).
- Shift + right-click yields Chrome's native menu.

## MCP / backend

- Storage: **Neon Postgres**. User supplies the connection string in `.env.local` as `DATABASE_URL`.
  NEVER pasted in chat, never printed, never committed; read only via `process.env`.
- Deploy target: **Vercel**.
- MCP transport: **both** stdio and HTTP/SSE for now; stdio is for local testing and gets
  removed once the HTTP/SSE endpoint is deployed and verified.
- Ruling: **no user accounts in v1** — single shared workspace as today. Management API and the
  MCP HTTP endpoint take a bearer token from env; the website itself stays open. Cost if wrong:
  a later auth layer has to add a user/owner column and scope queries to it; the data model is
  designed so that is an additive migration, not a rewrite.
- Ruling: **records persist in Postgres alongside schemas**. A deployed mock API with no stored
  records has nothing to serve, and MCP "access to everything" includes the data. Cost if wrong:
  more storage and a records table we could otherwise have generated on the fly.
- The existing service-layer seam (`src/lib/services/`) is the swap point — mock implementations
  are replaced by HTTP/db-backed ones behind the same interface, so UI components do not change.

## Standing security rules

- Secrets live only in `.env.local` (gitignored): `AZURE_AI_*`, `DATABASE_URL`, MCP token.
- The Azure API key pasted in chat earlier this session is compromised and must be rotated.

## Database findings (verified 2026-09-20, against the live Neon instance)

Schema smoke test — all passed:
- case-insensitive resource-name uniqueness per project
- duplicate (project, method, path) route rejected
- invalid field type rejected by the check constraint
- duplicate project slug rejected
- `link_to` is NULLED when its target model is deleted, rather than the field cascading away
- jsonb `filters` round-trips as an array
- deleting a project cascades to models and routes; records cascade with their model

Neon auto-suspend: the instance suspends after idle and the next connect takes ~5 seconds.
During a suspend, connects with a 12-20s timeout failed outright and looked like an outage.
Confirmed it was NOT connection exhaustion: a successful connect reported 1 backend connection.
Implications:
- Integration tests need `connectionTimeoutMillis` >= 30000 on the first connect. Retry loops are
  the wrong fix — they would mask real failures later.
- On Vercel, the first request after an idle period pays this cold start. If that becomes
  user-visible, the options are a paid Neon tier without auto-suspend, or a keep-warm ping.
