// Applies db/migrations/*.sql in order, each in its own transaction, recording what ran
// in a _migrations table so re-runs are no-ops.
//
//   node --env-file=.env.local scripts/db-migrate.mjs
//
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

const dir = join(process.cwd(), "db", "migrations");
const only = process.argv[2];
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Put it in .env.local and run with --env-file=.env.local");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
await client.query(`create table if not exists _migrations (
  name text primary key, applied_at timestamptz not null default now())`);

const applied = new Set((await client.query("select name from _migrations")).rows.map((r) => r.name));
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .filter((f) => !only || f === only);

for (const file of files) {
  if (applied.has(file)) {
    console.log(`skip  ${file} (already applied)`);
    continue;
  }
  const sql = readFileSync(join(dir, file), "utf8");
  try {
    await client.query("begin");
    await client.query(sql);
    await client.query("insert into _migrations (name) values ($1)", [file]);
    await client.query("commit");
    console.log(`apply ${file}`);
  } catch (e) {
    await client.query("rollback");
    console.error(`FAIL  ${file}: ${e.message}`);
    await client.end();
    process.exit(1);
  }
}

const ours = await client.query(`select tablename from pg_tables
  where schemaname = 'public'
    and tablename in ('users','accounts','sessions','verification_tokens',
                      'projects','models','fields','routes','records','api_tokens','_migrations')
  order by 1`);
console.log("\nuniversal-api tables present:", ours.rows.map((r) => r.tablename).join(", "));
await client.end();
