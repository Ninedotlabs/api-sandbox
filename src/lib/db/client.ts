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

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Add it to .env.local.");
  }
  return new Pool({ connectionString, ssl: resolveSsl(connectionString), max: MAX_POOL_CONNECTIONS });
}

export function getPool(): Pool {
  if (!globalThis.__universalApiPgPool) {
    globalThis.__universalApiPgPool = createPool();
  }
  return globalThis.__universalApiPgPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, params);
}

/**
 * Runs `fn` inside a BEGIN/COMMIT transaction on a dedicated client, rolling
 * back if `fn` throws. The client is always released back to the pool.
 */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
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
