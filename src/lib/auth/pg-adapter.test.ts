// @vitest-environment node
//
// Integration tests for both `pg-adapter.ts` and `claim-owner.ts` live in this one file,
// deliberately, rather than as two files: `claimOwnerlessProjects` reasons about "how many
// rows are in `users`" for the *entire* table, so its tests need exclusive use of that
// table for the duration of each one. Vitest runs test files across parallel workers, each
// with its own `pg.Pool` hitting the same physical test database, so if these lived in a
// separate file they could run at the same time as the adapter tests below - both insert
// into `users`/`accounts`/`sessions` - and race for real. Tests within a single file run
// sequentially, which sidesteps that without slowing down the rest of the suite the way
// disabling Vitest's file parallelism globally would.
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { getPool, query } from "@/lib/db/client";
import { createId } from "@/lib/ids";
import { claimOwnerlessProjects } from "./claim-owner";
import { pgAdapter } from "./pg-adapter";

const hasDb = Boolean(process.env.PG_TESTS_ENABLED);

// One pool for the whole file, closed once after both describe blocks finish - not inside
// either one, which would close it out from under whichever block runs second.
afterAll(async () => {
  if (hasDb) await getPool().end();
});

describe.skipIf(!hasDb)("pgAdapter", () => {
  const createdUserIds: string[] = [];
  afterEach(async () => {
    for (const id of createdUserIds.splice(0)) {
      await query("delete from users where id = $1", [id]);
    }
  });

  it("creates a user without the caller supplying an id", async () => {
    const user = await pgAdapter.createUser!({
      id: "",
      name: "Ada Lovelace",
      email: "ada@example.com",
      emailVerified: null,
      image: null,
    });
    createdUserIds.push(user.id);

    expect(user.id).toBeTruthy();
    expect(user.email).toBe("ada@example.com");
    expect(await pgAdapter.getUser!(user.id)).toEqual(user);
    expect(await pgAdapter.getUserByEmail!("ada@example.com")).toEqual(user);
  });

  it("links an account and resolves the user back by provider + providerAccountId", async () => {
    const user = await pgAdapter.createUser!({
      id: "",
      name: "Grace Hopper",
      email: "grace@example.com",
      emailVerified: null,
      image: null,
    });
    createdUserIds.push(user.id);

    await pgAdapter.linkAccount!({
      userId: user.id,
      type: "oauth",
      provider: "google",
      providerAccountId: "google-123",
      access_token: "at",
      expires_at: 1234,
      token_type: "bearer",
      scope: "openid email",
      id_token: "idt",
    });

    const found = await pgAdapter.getUserByAccount!({ provider: "google", providerAccountId: "google-123" });
    expect(found).toEqual(user);
  });

  it("round-trips a database session, including update and delete", async () => {
    const user = await pgAdapter.createUser!({
      id: "",
      name: "Katherine Johnson",
      email: "katherine@example.com",
      emailVerified: null,
      image: null,
    });
    createdUserIds.push(user.id);

    const expires = new Date(Date.now() + 60_000);
    const session = await pgAdapter.createSession!({ sessionToken: "tok_1", userId: user.id, expires });
    expect(session).toEqual({ sessionToken: "tok_1", userId: user.id, expires });

    const found = await pgAdapter.getSessionAndUser!("tok_1");
    expect(found).toEqual({ session, user });

    const newExpires = new Date(Date.now() + 120_000);
    const updated = await pgAdapter.updateSession!({ sessionToken: "tok_1", expires: newExpires });
    expect(updated?.expires).toEqual(newExpires);

    await pgAdapter.deleteSession!("tok_1");
    expect(await pgAdapter.getSessionAndUser!("tok_1")).toBeNull();
  });

  it("deleting a user cascades to their sessions and accounts", async () => {
    const user = await pgAdapter.createUser!({
      id: "",
      name: "Margaret Hamilton",
      email: "margaret@example.com",
      emailVerified: null,
      image: null,
    });
    await pgAdapter.linkAccount!({
      userId: user.id,
      type: "oauth",
      provider: "google",
      providerAccountId: "google-456",
      access_token: "at",
      token_type: "bearer",
      scope: "openid email",
    });
    await pgAdapter.createSession!({ sessionToken: "tok_2", userId: user.id, expires: new Date(Date.now() + 60_000) });

    await pgAdapter.deleteUser!(user.id);

    expect(await pgAdapter.getUser!(user.id)).toBeNull();
    expect(await pgAdapter.getSessionAndUser!("tok_2")).toBeNull();
    expect(await pgAdapter.getUserByAccount!({ provider: "google", providerAccountId: "google-456" })).toBeNull();
  });

  it("round-trips a verification token, consuming it on use", async () => {
    const expires = new Date(Date.now() + 60_000);
    await pgAdapter.createVerificationToken!({ identifier: "someone@example.com", token: "abc", expires });

    const used = await pgAdapter.useVerificationToken!({ identifier: "someone@example.com", token: "abc" });
    expect(used).toEqual({ identifier: "someone@example.com", token: "abc", expires });

    expect(await pgAdapter.useVerificationToken!({ identifier: "someone@example.com", token: "abc" })).toBeNull();
  });
});

describe.skipIf(!hasDb)("claimOwnerlessProjects", () => {
  // This feature reasons about "how many rows are in `users`", so every test in this
  // block needs to own that table completely rather than share it with whatever else
  // is running - see the file-level comment above for why that's safe here.
  beforeEach(async () => {
    await query("delete from sessions");
    await query("delete from accounts");
    await query("delete from api_tokens");
    await query("delete from users");
  });

  const createdProjectIds: string[] = [];
  afterEach(async () => {
    for (const id of createdProjectIds.splice(0)) {
      await query("delete from projects where id = $1", [id]);
    }
    await query("delete from sessions");
    await query("delete from accounts");
    await query("delete from api_tokens");
    await query("delete from users");
  });

  async function insertUser(id: string, email: string): Promise<void> {
    await query("insert into users (id, name, email) values ($1, $2, $3)", [id, email, email]);
  }

  async function insertProject(ownerId: string | null): Promise<string> {
    const id = createId("prj");
    await query(
      "insert into projects (id, owner_id, name, slug) values ($1, $2, $3, $4)",
      [id, ownerId, "Test Project", `test-project-${id}`],
    );
    createdProjectIds.push(id);
    return id;
  }

  async function ownerOf(projectId: string): Promise<string | null> {
    const { rows } = await query<{ owner_id: string | null }>("select owner_id from projects where id = $1", [projectId]);
    return rows[0]?.owner_id ?? null;
  }

  it("claims every ownerless project when the users table was empty beforehand", async () => {
    const p1 = await insertProject(null);
    const p2 = await insertProject(null);
    const user = "usr_first";
    await insertUser(user, "first@example.com");

    await claimOwnerlessProjects(user);

    expect(await ownerOf(p1)).toBe(user);
    expect(await ownerOf(p2)).toBe(user);
  });

  it("claims nothing when a second user already exists", async () => {
    await insertUser("usr_first", "first@example.com");
    await insertUser("usr_second", "second@example.com");
    const orphan = await insertProject(null);

    await claimOwnerlessProjects("usr_second");

    expect(await ownerOf(orphan)).toBeNull();
  });

  it("is transactional: a failing update leaves ownerless projects untouched", async () => {
    // Exactly one real user exists, so the "first user" branch is taken, but the id
    // passed in doesn't reference any row in `users` - the update's foreign key fails,
    // and the whole operation must roll back rather than leave a half-applied claim.
    await insertUser("usr_real", "real@example.com");
    const orphan = await insertProject(null);

    await expect(claimOwnerlessProjects("usr_does_not_exist")).rejects.toThrow();

    expect(await ownerOf(orphan)).toBeNull();
  });

  it("is idempotent if it somehow runs twice", async () => {
    const orphan = await insertProject(null);
    const user = "usr_first";
    await insertUser(user, "first@example.com");

    await claimOwnerlessProjects(user);
    await claimOwnerlessProjects(user);

    expect(await ownerOf(orphan)).toBe(user);
  });
});
