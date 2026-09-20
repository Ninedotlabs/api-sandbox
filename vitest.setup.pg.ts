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
