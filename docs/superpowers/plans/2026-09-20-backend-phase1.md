# Backend Phase 1 — Management API, HTTP services, migration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Move the source of truth from browser localStorage to Postgres, without the UI changing and without anyone losing the projects they already have.

**Architecture:** The store keeps calling `src/lib/services/*`. A new `http/` implementation of those same interfaces calls `/api/v1/*`, whose handlers call the `pg/` implementations server-side. One interface, three implementations (`mock`, `http`, `pg`), selected in one place.

**Tech Stack:** Next.js 16 route handlers (`runtime = "nodejs"`), `pg`, zod 4, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-20-backend-and-mcp-design.md`

## Global Constraints

- The service interfaces in `src/lib/services/types.ts` are the contract. `http/` and `pg/` implement the same methods with identical semantics; no UI component changes.
- Every handler is `runtime = "nodejs"`, returns `{ data }` or `{ error: string }` with a plain-language message, and uses these statuses: 200/201 success, 400 zod validation, 404 unknown id, 409 conflict (duplicate slug, duplicate method+path), 500 unexpected.
- `DATABASE_URL` and `UNIVERSAL_API_TOKEN` are read only via `process.env`, server-side, never logged, never `NEXT_PUBLIC_*`, never returned in a response body.
- External (non-same-origin) callers must send `Authorization: Bearer <UNIVERSAL_API_TOKEN>`. Same-origin browser requests need no credential while auth is deferred. This is not a security boundary against non-browser clients, and the docs must say so plainly.
- Reserved slugs, rejected at create time: `v1`, `ai`, `mcp`, `auth`, `api`.
- No data-losing step ships without the import in Task C working first.
- Before each commit: `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` clean.

---

## Task A: `/api/v1` management API

**Files:** `src/app/api/v1/**/route.ts`, `src/lib/api/respond.ts`, `src/lib/api/auth.ts` (+ tests)

**Produces:** the endpoint list in spec §3, over the `pg` services from the prior task.

- `src/lib/api/respond.ts` — `ok(data, status?)`, `fail(status, message)`, and `handle(fn)` which wraps a handler in try/catch, maps a thrown `ConflictError`/`NotFoundError` to 409/404 and anything else to a 500 whose body is a generic message (never the raw error text, which can carry SQL and connection details).
- `src/lib/api/auth.ts` — `requireAccess(req)`: allow when `Sec-Fetch-Site` is `same-origin`/`same-site`, or when `Authorization: Bearer` matches `UNIVERSAL_API_TOKEN`; otherwise 401 "This endpoint needs an API token." Compare tokens with `crypto.timingSafeEqual` over equal-length buffers, not `===`.
- One route file per resource path in spec §3. Bodies validated with zod; a zod failure becomes a 400 naming the first offending field in plain language.
- Tests (node environment, `pg` services mocked): one per endpoint asserting status and exact error strings, plus auth allowed/denied.

---

## Task B: HTTP services and selection

**Files:** `src/lib/services/http/*.ts`, `src/lib/services/index.ts` (+ tests)

- `http/` mirrors `mock/` method for method, each one a `fetch` to the matching `/api/v1` endpoint, throwing an `Error` carrying the server's plain-language `error` string so existing store try/catch blocks surface it unchanged.
- `src/lib/services/index.ts` selects: `http` in the browser, `pg` on the server, `mock` when `NEXT_PUBLIC_USE_MOCK_SERVICES=1` (kept so component tests keep running without a database).
- **Optimistic updates.** Real latency makes every field edit visibly laggy. `saveModel`, `updateProject` and `saveRoute` apply to local state first, then reconcile; on failure they roll back to the pre-edit snapshot and `toast.error`. Tests: a failing save restores the previous value and shows the error; a slow save does not block typing.
- Delete the fake-latency helper from the mock services once nothing depends on it.

---

## Task C: one-time localStorage import

**Files:** `src/lib/migrate-local.ts`, `src/components/migrate/import-banner.tsx` (+ tests)

This is the task that protects real user data; it ships before Task B's selection flips to `http`.

- `readLocalProjects()` parses the persisted Zustand payload from localStorage and returns `Project[]`, tolerating a missing or malformed value by returning `[]` rather than throwing.
- On first load, if localStorage holds projects **and** `GET /api/v1/projects` returns none, show a banner: "Found N APIs saved in this browser. Move them to your account?" with **Import** and **Not now**. Never auto-import, and never clear localStorage until the server confirms every project was written.
- Import posts each project, its models, its routes and its records through the API, reporting per-project success and leaving anything that failed in localStorage with the reason shown.
- On success, write a `universal-api:migrated` flag so the banner does not reappear. Keep the localStorage data — it costs nothing and is a safety net.
- Tests: projects present + server empty shows the banner; server non-empty does not; a partial failure keeps the failed project and reports it; the flag suppresses the banner.

---

## Task D: mock APIs answer real HTTP

**Files:** `src/app/api/[slug]/[...path]/route.ts` (+ tests)

- Export `GET`, `POST`, `PUT`, `PATCH`, `DELETE` and `OPTIONS` from one handler.
- Resolve the project by slug (404 with a plain-language JSON body if unknown), match the request against its routes including `:param` segments, load that model's records, run the existing `executeRoute` from `src/lib/mock-engine.ts`, persist any mutation, and return the engine's status and body.
- CORS open (`Access-Control-Allow-Origin: *`, `OPTIONS` answered) — a mock API a browser cannot call is useless, and mock data holds nothing confidential.
- Tests: end-to-end over real HTTP against a seeded project — list, get, 404 on unknown id, create with a missing required field (400), valid create (201), update, delete, and a `:param` route.

---

## Task D2: preserve records across delete and undo (BLOCKING — do not ship Phase 1 without it)

**Files:** `src/lib/services/types.ts`, `src/lib/services/pg/*`, `src/lib/services/mock/*`, `src/store/project-store.ts` (+ tests)

Found by the `pg` layer review. `records.model_id` is `ON DELETE CASCADE`, so deleting a model or a project physically destroys its records. `RemovedModel` and `Project` carry no record data, so `restore` cannot bring them back. The mock never exposed this, because its dataset lives in a separate structure that `ModelService.remove` never clears — delete-then-undo silently preserved records there. On Postgres they are gone for good.

User-visible failure: seed hand-authored records, delete the resource, click Undo. The schema, fields and endpoints come back; every record is gone, with no error and no warning. The same applies to deleting a whole project.

- `RemovedModel` gains `records: Record<string, unknown>[]`. `ModelService.remove` captures them before the delete; `restore` reinserts them.
- Project deletion needs the same: `ProjectService.remove` returns the records alongside the project (a `RemovedProject { project, records: { modelId, records }[] }`), and `restore` puts them back. This changes the store's `deleteProject`/`restoreProject` signatures, which this phase is already rewriting.
- Both the `mock` and `pg` implementations change together, and the existing mock tests must still pass.
- Tests: seed records, delete the model, restore, assert the records come back with their ids; same for a project; a resource with no records restores cleanly.

## Task D3: sample data on a new project

**Files:** `src/lib/services/pg/record-service.ts` or the create path (+ tests)

Also from the `pg` review. The mock lazily auto-seeds sample data on first read, so a newly created project immediately shows records. The pg `RecordService` returns `[]` until `reset()` is explicitly called. A straight swap makes every new project look empty, which reads as a bug.

Decide and implement one of: seed on project/model creation (matching today's behaviour), or make "empty until you generate data" the intended product behaviour with an empty state that says so. Do not leave it implicit — today's behaviour is the default unless there is a reason to change it.

## Task E: reconcile and delete dead code

**Files:** `src/lib/services/mock/**`, docs

- Keep `mock/` only for tests; remove anything now unreachable.
- Update `AGENTS.md`/README with how to run migrations and how to point at a different database.
- Ledger any behaviour that changed for users (optimistic saves, real latency, projects now shared across browsers).
