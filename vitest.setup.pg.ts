// Loads `.env.local` into `process.env` for the pg integration tests
// (`src/lib/services/pg/*.test.ts`, `src/lib/db/*.test.ts`), since Vitest
// doesn't read it the way `node --env-file` does. Only fills variables that
// aren't already set, so a value exported in the shell (used when pointing
// tests at a local Postgres instead of the real database) always wins.
// No credential is hardcoded here - everything comes from the file or the
// existing environment, and if neither has DATABASE_URL the integration
// tests skip themselves cleanly.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal(): void {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  const contents = readFileSync(path, "utf8");
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvLocal();

// The integration tests create and delete real rows, so they must never be able to
// reach the application's own database. They run only against PG_TEST_DATABASE_URL —
// a database you nominate for the purpose, normally a local Postgres:
//
//   docker run --rm -d -p 5433:5432 -e POSTGRES_PASSWORD=postgres postgres:16-alpine
//   export PG_TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5433/postgres
//   node --env-file=.env.local scripts/db-migrate.mjs   # against that URL
//
// With it unset, DATABASE_URL is removed from the test environment entirely so nothing
// downstream can fall back to it, and the integration suites skip themselves.
delete process.env.DATABASE_URL;
if (process.env.PG_TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.PG_TEST_DATABASE_URL;

// Having a URL is not the same as the database answering: a cold or absent server would
// otherwise hang the suite and fail it for reasons unrelated to the code under test.
// Probe once per worker, patiently, and skip cleanly when it cannot connect.
async function probeDatabase(): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  const { Client } = await import("pg");
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes("localhost") ? undefined : { rejectUnauthorized: false },
    connectionTimeoutMillis: 30_000,
  });
  try {
    await client.connect();
    await client.query("select 1");
    process.env.PG_TESTS_ENABLED = "1";
  } catch {
    // Left unset: the integration suites skip themselves.
  } finally {
    await client.end().catch(() => {});
  }
}

await probeDatabase();
