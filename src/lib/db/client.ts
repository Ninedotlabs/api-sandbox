import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";

// Next's dev server hot-reloads modules on every save, which would otherwise
// create a fresh `pg.Pool` (and a fresh set of TCP connections) each time.
// Caching the pool on `globalThis` survives the reload.
declare global {
  var __universalApiPgPool: Pool | undefined;
}

/**
 * Neon (and most managed Postgres) requires TLS, but a plain local Postgres
 * used for testing generally doesn't speak TLS at all. Rather than force
 * every test environment to configure a certificate, treat `localhost` /
 * `127.0.0.1` connections as plaintext and everything else as Neon-style TLS
 * with certificate verification relaxed, matching Neon's own guidance.
 */
function resolveSsl(connectionString: string): false | { rejectUnauthorized: false } {
  try {
    const { hostname } = new URL(connectionString);
    if (hostname === "localhost" || hostname === "127.0.0.1") return false;
  } catch {
    // Not a parseable URL; fall through to the Neon-style default below.
  }
  return { rejectUnauthorized: false };
}

// Kept small deliberately: this pool exists per process (per warm serverless
// instance in production, per isolated test-file worker here), and Neon's
// pooler endpoint still has a cap on concurrent backend connections across
// every process hitting it at once. A handful of connections per process is
// enough for this app's traffic and leaves headroom for other processes.
const MAX_POOL_CONNECTIONS = 3;

// Neon (and most managed Postgres) auto-suspends when idle; the first connect after that wakes
// compute and can take several seconds, per `AGENTS.md` and the same reasoning
// `vitest.setup.pg.ts` uses for its own one-time probe. A short timeout would turn a normal
// cold start into a hard failure, so this is generous on purpose.
const CONNECTION_TIMEOUT_MILLIS = 30_000;

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Add it to .env.local.");
  }
  return new Pool({
    connectionString,
    ssl: resolveSsl(connectionString),
    max: MAX_POOL_CONNECTIONS,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MILLIS,
  });
}

export function getPool(): Pool {
  if (!globalThis.__universalApiPgPool) {
    globalThis.__universalApiPgPool = createPool();
  }
  return globalThis.__universalApiPgPool;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Bounded on purpose: this covers a cold start waking compute, not a general-purpose retry
// loop (see the roadmap note ruling those out for the same class of failure - masking a real
// outage instead of surfacing it). A handful of quick attempts is enough to ride out the
// window where the first connect can fail outright while DNS/compute comes back; anything
// still failing after that is a real problem the caller should see.
const MAX_CONNECT_ATTEMPTS = 3;
const CONNECT_RETRY_DELAY_MILLIS = 300;

/**
 * Checks out a client from the pool, retrying a bounded number of times if *acquiring the
 * connection itself* fails. Once a client is acquired, whatever happens on it - a query error,
 * a reset mid-query - is never retried here: a write might have partially applied, and
 * retrying it blind could apply it twice. Only the connect step, which runs no user query, is
 * safe to retry.
 */
async function connectWithRetry(): Promise<PoolClient> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_CONNECT_ATTEMPTS; attempt++) {
    try {
      return await getPool().connect();
    } catch (error) {
      lastError = error;
      if (attempt < MAX_CONNECT_ATTEMPTS) await sleep(CONNECT_RETRY_DELAY_MILLIS);
    }
  }
  throw lastError;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  const client = await connectWithRetry();
  try {
    return await client.query<T>(text, params);
  } finally {
    client.release();
  }
}

/**
 * Runs `fn` inside a BEGIN/COMMIT transaction on a dedicated client, rolling
 * back if `fn` throws. The client is always released back to the pool.
 */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await connectWithRetry();
  try {
    await client.query("begin");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
