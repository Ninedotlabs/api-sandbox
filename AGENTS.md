<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Running the Postgres integration tests

The `src/lib/services/pg/**` suites talk to a real database. They run only when
`PG_TEST_DATABASE_URL` is set and skip cleanly otherwise, so a checkout with no database stays
green.

They must never run against `DATABASE_URL` — that is the application's own database, and these
tests create and delete rows. `vitest.setup.pg.ts` enforces this by deleting `DATABASE_URL` from
the test environment and mapping `PG_TEST_DATABASE_URL` onto it.

```bash
docker run --rm -d --name ua-test-pg -p 5433:5432 \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=universal_api_test postgres:16-alpine

DATABASE_URL="postgres://postgres:postgres@localhost:5433/universal_api_test" \
  node scripts/db-migrate.mjs

PG_TEST_DATABASE_URL="postgres://postgres:postgres@localhost:5433/universal_api_test" npm test
```

Migrations live in `db/migrations/` and are applied in order by `scripts/db-migrate.mjs`, which
records what it ran in a `_migrations` table, so re-runs are no-ops.

Note that the hosted database auto-suspends when idle and takes several seconds to wake. That is
why the test setup probes once with a long timeout rather than assuming a connection is instant.
