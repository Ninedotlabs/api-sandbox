// @vitest-environment node
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { getPool, query } from "@/lib/db/client";
import { createId } from "@/lib/ids";
import {
  LAST_ADMIN_MESSAGE,
  getUserRole,
  isConfiguredAdminEmail,
  parseAdminEmails,
  promoteIfConfiguredAdmin,
  setUserRole,
} from "./roles";

describe("ADMIN_EMAILS", () => {
  it("splits on commas, trims and lowercases", () => {
    expect(parseAdminEmails(" A@Example.com, b@example.com ,,")).toEqual(new Set(["a@example.com", "b@example.com"]));
  });

  it("is empty when unset", () => {
    expect(parseAdminEmails(undefined).size).toBe(0);
  });

  it("matches case-insensitively and never matches a missing email", () => {
    const env = { ADMIN_EMAILS: "Owner@Example.com" } as unknown as NodeJS.ProcessEnv;
    expect(isConfiguredAdminEmail("owner@example.COM", env)).toBe(true);
    expect(isConfiguredAdminEmail("someone@example.com", env)).toBe(false);
    expect(isConfiguredAdminEmail(null, env)).toBe(false);
  });
});

const hasDb = Boolean(process.env.PG_TESTS_ENABLED);

// Every test that creates an admin lives in this one file, so the "last admin" count isn't
// disturbed by other suites running in parallel against the same database.
describe.skipIf(!hasDb)("roles (Postgres)", () => {
  const userIds: string[] = [];
  const ORIGINAL_ADMIN_EMAILS = process.env.ADMIN_EMAILS;

  afterEach(async () => {
    if (ORIGINAL_ADMIN_EMAILS === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = ORIGINAL_ADMIN_EMAILS;
    if (userIds.length) await query("delete from users where id = any($1::text[])", [userIds.splice(0)]);
  });

  afterAll(async () => {
    await getPool().end();
  });

  async function user(role: "user" | "admin" = "user"): Promise<{ id: string; email: string }> {
    const id = createId("usr");
    const email = `${id}@example.com`;
    userIds.push(id);
    await query("insert into users (id, name, email, role) values ($1, $2, $3, $4)", [id, id, email, role]);
    return { id, email };
  }

  it("defaults new accounts to the user role", async () => {
    const id = createId("usr");
    userIds.push(id);
    await query("insert into users (id, email) values ($1, $2)", [id, `${id}@example.com`]);
    expect(await getUserRole(id)).toBe("user");
  });

  it("treats an unknown account as a non-admin", async () => {
    expect(await getUserRole("usr_missing")).toBe("user");
  });

  it("promotes an account listed in ADMIN_EMAILS, and leaves others alone", async () => {
    const listed = await user();
    const other = await user();
    process.env.ADMIN_EMAILS = listed.email.toUpperCase();

    expect(await promoteIfConfiguredAdmin(listed.id, listed.email)).toBe(true);
    expect(await promoteIfConfiguredAdmin(other.id, other.email)).toBe(false);
    expect(await getUserRole(listed.id)).toBe("admin");
    expect(await getUserRole(other.id)).toBe("user");
  });

  it("promotes and demotes, but refuses to demote the last admin", async () => {
    // Clear any admins left in the test database so this user really is the only one.
    await query("update users set role = 'user' where role = 'admin'");
    const first = await user("admin");
    const second = await user();

    await expect(setUserRole(first.id, "user")).rejects.toThrow(LAST_ADMIN_MESSAGE);
    expect(await getUserRole(first.id)).toBe("admin");

    expect(await setUserRole(second.id, "admin")).toBe(true);
    expect(await setUserRole(first.id, "user")).toBe(true);
    expect(await getUserRole(first.id)).toBe("user");
  });

  it("reports a missing account instead of silently succeeding", async () => {
    expect(await setUserRole("usr_missing", "admin")).toBe(false);
  });
});
