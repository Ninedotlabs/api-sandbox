// @vitest-environment node
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { getPool, query } from "@/lib/db/client";
import { createId } from "@/lib/ids";
import { authenticateApiToken, createApiToken, listApiTokens, revokeApiToken } from "./api-token";

const hasDb = Boolean(process.env.PG_TESTS_ENABLED);

describe.skipIf(!hasDb)("personal API tokens", () => {
  const userIds: string[] = [];

  afterEach(async () => {
    if (userIds.length) await query("delete from users where id = any($1::text[])", [userIds.splice(0)]);
  });

  afterAll(async () => {
    await getPool().end();
  });

  async function user(label: string): Promise<string> {
    const id = createId("usr");
    userIds.push(id);
    await query("insert into users (id, name, email) values ($1, $2, $3)", [id, label, `${id}@example.com`]);
    return id;
  }

  it("creates unique hash-only credentials scoped to their owner and revokes immediately", async () => {
    const alice = await user("Alice");
    const bob = await user("Bob");

    const aliceToken = await createApiToken(alice, "Claude Desktop");
    const bobToken = await createApiToken(bob, "Claude Desktop");

    expect(aliceToken.token).toMatch(/^ua_[A-Za-z0-9_-]{40,}$/);
    expect(bobToken.token).not.toBe(aliceToken.token);
    expect(await listApiTokens(alice)).toEqual([aliceToken.summary]);
    expect(await listApiTokens(bob)).toEqual([bobToken.summary]);

    const stored = await query<{ token_hash: string }>("select token_hash from api_tokens where id = $1", [aliceToken.summary.id]);
    expect(stored.rows[0].token_hash).not.toContain(aliceToken.token);

    expect(await authenticateApiToken(aliceToken.token)).toBe(alice);
    expect((await listApiTokens(alice))[0].lastUsedAt).not.toBeNull();

    expect(await revokeApiToken(bob, aliceToken.summary.id)).toBe(false);
    expect(await revokeApiToken(alice, aliceToken.summary.id)).toBe(true);
    expect(await authenticateApiToken(aliceToken.token)).toBeNull();
  });
});
