/**
 * Neon (and most managed Postgres) auto-suspends when idle; the first connect after that can
 * fail outright while compute wakes, which is an expected condition, not an error. These tests
 * exercise the bounded connect-retry in `client.ts` against a fake `pg.Pool` - never a real
 * database - so they run everywhere, not just with `PG_TEST_DATABASE_URL` set.
 *
 * A *query* failure (as opposed to a *connection* failure) must never be retried - a query may
 * have partially applied, and retrying it blind could apply it twice.
 */
import type { PoolClient } from "pg";

const { poolInstances, PoolMock } = vi.hoisted(() => {
  const poolInstances: unknown[] = [];
  class PoolMock {
    connect: ReturnType<typeof vi.fn>;
    query: ReturnType<typeof vi.fn>;
    constructor() {
      this.connect = vi.fn();
      this.query = vi.fn();
      poolInstances.push(this);
    }
  }
  return { poolInstances, PoolMock };
});

vi.mock("pg", () => ({ Pool: PoolMock }));

function fakeClient(overrides: Partial<PoolClient> = {}): PoolClient {
  return { query: vi.fn(), release: vi.fn(), ...overrides } as unknown as PoolClient;
}

describe("db client connection retry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    poolInstances.length = 0;
    globalThis.__universalApiPgPool = undefined;
    process.env.DATABASE_URL = "postgres://user:pass@example.invalid/db";
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.__universalApiPgPool = undefined;
  });

  it("retries a connection-level failure a bounded number of times, then succeeds", async () => {
    const { query, getPool } = await import("./client");
    const client = fakeClient({ query: vi.fn().mockResolvedValue({ rows: [{ ok: 1 }] }) });
    const pool = getPool() as unknown as InstanceType<typeof PoolMock>;
    pool.connect
      .mockRejectedValueOnce(new Error("Connection terminated unexpectedly"))
      .mockRejectedValueOnce(new Error("Connection terminated unexpectedly"))
      .mockResolvedValueOnce(client);

    const promise = query("select 1");
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toEqual({ rows: [{ ok: 1 }] });
    expect(pool.connect).toHaveBeenCalledTimes(3);
    expect(client.query).toHaveBeenCalledTimes(1);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it("gives up cleanly after exhausting its bounded connection retries", async () => {
    const { query, getPool } = await import("./client");
    const pool = getPool() as unknown as InstanceType<typeof PoolMock>;
    pool.connect.mockRejectedValue(new Error("Connection terminated unexpectedly"));

    const promise = query("select 1");
    const assertion = expect(promise).rejects.toThrow("Connection terminated unexpectedly");
    await vi.runAllTimersAsync();
    await assertion;

    // Bounded: a handful of attempts, not an unbounded loop.
    expect(pool.connect.mock.calls.length).toBeGreaterThan(1);
    expect(pool.connect.mock.calls.length).toBeLessThanOrEqual(5);
  });

  it("does not retry a query error - only connection acquisition is retried", async () => {
    const { query, getPool } = await import("./client");
    const client = fakeClient({ query: vi.fn().mockRejectedValue(new Error("syntax error at or near")) });
    const pool = getPool() as unknown as InstanceType<typeof PoolMock>;
    pool.connect.mockResolvedValue(client);

    await expect(query("not sql")).rejects.toThrow("syntax error at or near");

    expect(pool.connect).toHaveBeenCalledTimes(1);
    expect(client.query).toHaveBeenCalledTimes(1);
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});
