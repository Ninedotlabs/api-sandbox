# Backend, Management API and MCP — Design

**Status:** proposed
**Date:** 2026-09-20
**Depends on:** `db/migrations/0001_init.sql` (applied to Neon)

## 1. The central realisation

The app's data layer and the public management API are **the same API**.

Today every UI data call goes through `src/lib/services/*`, which the Zustand store calls
directly from client components — mock implementations reading localStorage. Postgres is not
reachable from a browser, so those calls must become HTTP calls to our own server.

That transport *is* the management API. Building it once gives us both, and guarantees the
public API covers every feature of the website — because the website is its first and most
demanding consumer. An API surface that the UI doesn't exercise is an API surface that rots.

```
browser (Zustand store)
  → src/lib/services/http/*        same interfaces as the mock services
  → POST/GET /api/v1/...           the management API
  → src/lib/services/pg/*          real implementations, server-side only
  → Neon Postgres

MCP server ─────────────────────→ /api/v1/...   (the same API, with a bearer token)
```

The service interfaces in `src/lib/services/types.ts` do not change. No UI component changes.
That seam was built for exactly this swap.

## 2. Phases

Each phase ships working software and gets its own implementation plan.

| Phase | Deliverable |
|---|---|
| 1 | `/api/v1/*` management API + `pg` services + `http` services; the UI runs on Postgres |
| 2 | `/api/:slug/*` — mock APIs answer real HTTP from curl, Postman, anything |
| 3 | MCP server (stdio + HTTP/SSE), one tool per API operation |
| 4 | `/mcp` docs page on the website |

Phase 2 is the one that changes what the product *is*: until it exists, a "mock API" only
answers inside the in-page console.

## 3. Phase 1 — Management API and the persistence swap

### Endpoints

All under `/api/v1`, all JSON, all `runtime = "nodejs"`.

```
GET    /projects                      list
POST   /projects                      create           { name, description?, templateId? }
GET    /projects/:id                  full project (models + routes)
PATCH  /projects/:id                  { name?, description?, slug? }
DELETE /projects/:id                  → the deleted project, for undo
POST   /projects/:id/restore          { project }
POST   /projects/:id/duplicate        → the new project

POST   /projects/:id/models           { name }
PATCH  /projects/:id/models/:modelId  full model (fields included)
DELETE /projects/:id/models/:modelId  → RemovedModel, for undo
POST   /projects/:id/models/:modelId/restore

POST   /projects/:id/routes           { routes: Route[] }   (createMany)
PATCH  /projects/:id/routes/:routeId
DELETE /projects/:id/routes/:routeId  → RemovedRoute, for undo
POST   /projects/:id/routes/:routeId/restore

GET    /projects/:id/models/:modelId/records
PUT    /projects/:id/models/:modelId/records    replace the whole set (seedRecords)
POST   /projects/:id/models/:modelId/records    append one
DELETE /projects/:id/models/:modelId/records/:recordId

POST   /projects/:id/ai/generate      existing AI generate, now persisting
POST   /projects/:id/ai/edit          existing AI edit, now persisting
```

Every response is `{ data }` or `{ error: string }` with a plain-language message. Status codes:
200/201 success, 400 validation (zod), 404 unknown id, 409 conflict (duplicate slug, duplicate
method+path), 500 unexpected.

### Access control while auth is deferred

The website is deliberately open, so same-origin browser requests need no credential. External
clients — MCP included — must send `Authorization: Bearer <UNIVERSAL_API_TOKEN>`.

A request is treated as same-origin when its `Origin`/`Sec-Fetch-Site` header says so. This is
**not** a security boundary against a determined attacker (headers are forgeable by non-browser
clients), and the spec states that plainly: with auth deferred, anyone who can reach the
deployment can modify mock data. That is an accepted, temporary property of a tool with no
sign-in — it is the reason `owner_id` already exists on `projects`, so adding real auth later
scopes queries instead of reshaping tables. Nothing secret is ever stored in a mock API.

### Data mapping

`src/lib/services/pg/` implements the existing interfaces over the schema already created:

- A project read is one query per table joined in application code into the nested
  `Project { models: Model[{fields}], routes: Route[] }` shape the UI expects — `fields.position`
  and `routes.position` preserve order.
- `fields.is_unique` maps to `Field.unique`; `fields.link_to` to `Field.linkTo`;
  `fields.options` (jsonb) to `Field.options`.
- Records map to `Dataset` as `Record<modelId, DataRecord[]>`, `records.data` merged with
  `records.id`.
- Writes that change several rows (saving a model's whole field list, `createMany` routes,
  `seedRecords`, `duplicate`, `applyPlan`/`applyEditPlan`) run in a transaction.

### Connection handling

`src/lib/db/client.ts` exports a singleton `pg.Pool` against the Neon **pooler** host, cached on
`globalThis` so Next's dev hot-reload doesn't leak pools. Vercel's serverless functions get a
small pool (`max: 1`) since each invocation is short-lived and Neon pools upstream anyway.

Note for the implementer: `@neondatabase/serverless`'s HTTP driver failed to connect from this
environment while plain `pg` over TCP succeeded, so `pg` is the driver of record. Revisit only if
Vercel cold-start latency proves to be a problem.

### Optimistic UI

The store currently awaits a ~200ms fake latency and then re-reads. Over a real network that
becomes visible lag on every keystroke-driven save. Field edits and renames therefore apply to
local state first and reconcile on the response, rolling back with a `toast.error` on failure.
This is a behaviour change and needs its own tests.

## 4. Phase 2 — Mock APIs answer real HTTP

`src/app/api/[slug]/[...path]/route.ts` handles all five methods:

1. Look up the project by `slug`; 404 with a plain-language body if unknown.
2. Match the request against the project's routes (existing path matching, `:param` segments).
3. Load that model's records, run the existing `executeRoute` from `src/lib/mock-engine.ts`,
   persist any mutation, return the result with its status.

The engine is reused unchanged — it already implements list/get/create/update/delete, validation
errors and 404s. Only its data source moves from an in-memory `Dataset` to Postgres.

CORS is open (`Access-Control-Allow-Origin: *`) for these routes: a mock API that a browser app
cannot call is useless, and there is nothing confidential in mock data.

Reserved slugs (`v1`, `ai`, `mcp`, `auth`) are rejected at project-creation time so a project can
never shadow a system route.

## 5. Phase 3 — MCP server

One tool per meaningful operation, thin wrappers over `/api/v1`. Tool names are verb-first and
scoped: `list_projects`, `get_project`, `create_project`, `update_project`, `delete_project`,
`duplicate_project`, `create_resource`, `update_resource`, `delete_resource`, `create_endpoints`,
`update_endpoint`, `delete_endpoint`, `list_records`, `replace_records`, `add_record`,
`delete_record`, `generate_api` (AI generate), `edit_api` (AI edit), `call_mock_endpoint`.

Every tool takes explicit zod-validated arguments and returns compact JSON. Destructive tools
(`delete_*`, `replace_records`) state in their description that the change is immediate and that
the undo payload is returned in the result.

**Transports, both from one tool definition module:**

- **stdio** — `src/mcp/stdio.ts`, shipped as a bin so it runs with
  `claude mcp add universal-api -- node ./dist/mcp/stdio.js`. Reads `UNIVERSAL_API_URL`
  (default `http://localhost:3000`) and `UNIVERSAL_API_TOKEN` from the environment.
- **HTTP/SSE** — `src/app/api/mcp/route.ts`, using the Streamable HTTP transport, authenticated
  with the same bearer token. This is the one that survives after deployment; stdio is removed
  once it is verified on Vercel, per the stated plan.

The tool definitions, their zod schemas and their handlers live in `src/mcp/tools.ts` and are
imported by both transports, so the two can never drift.

## 6. Phase 4 — `/mcp` docs page

A page on the site, in the existing visual system, with:

- A copy-paste block for `claude mcp add`, and the JSON form for Claude Desktop's config.
- The token: shown masked with a copy button, read from the server, never rendered into the
  page source for anonymous visitors.
- A table of every tool: name, one-line purpose, arguments, example call.
- A short "what you can ask Claude to do" section with worked examples
  ("add a Reviews resource to my Bookshop API and give it 10 sample rows").

The tool table is generated from the same `src/mcp/tools.ts` definitions at build time, so the
docs cannot describe a tool that does not exist.

## 7. Testing

- `pg` services: integration tests against a disposable Neon branch (or a local Postgres in CI),
  covering the nested read shape, transactional writes, cascade deletes and the undo/restore
  round-trip.
- Route handlers: node-environment tests with the services mocked, asserting status codes and
  exact error strings.
- Mock-API execution: end-to-end through `/api/:slug/*` — create a project, seed records, then
  list/get/create/update/delete over real HTTP.
- MCP tools: each handler tested against a mocked API layer; one smoke test that the stdio and
  HTTP transports expose an identical tool list.

## 8. Risks

- **The optimistic-UI change is the most likely source of subtle bugs** — a failed save that
  rolls back while the user keeps typing. It gets the most test attention.
- **Migration of existing localStorage projects.** Users (including you) have projects in the
  browser today. Phase 1 ships a one-time import: on first load, if localStorage holds projects
  and the database has none, offer to upload them, then mark localStorage as migrated. Without
  this, Phase 1 looks like data loss.
- **Serverless connection limits.** Mitigated by the Neon pooler and `max: 1`; watch for
  `too many connections` under load.
