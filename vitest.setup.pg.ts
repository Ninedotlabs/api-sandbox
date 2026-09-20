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

// Having DATABASE_URL is not the same as the database answering. Neon auto-suspends
// after idle and its cold start takes several seconds, so a suite that assumes
// reachability hangs and then fails for reasons unrelated to the code under test.
// Probe once per worker, patiently, and let the integration suites skip cleanly when
// the database is asleep, unreachable, or simply not part of this run.
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
