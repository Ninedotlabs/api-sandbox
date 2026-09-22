import { query, withTransaction } from "@/lib/db/client";

/**
 * The admin role (see `docs/superpowers/specs/2026-09-22-admin-dashboard-design.md` §2).
 *
 * Role lives in `users.role`, read with its own query rather than added to the Auth.js
 * adapter's selects: code can reach production before `0003_admin.sql` has run there, and a
 * missing column must mean "not an admin", never "nobody can sign in".
 */
export type UserRole = "user" | "admin";

export const LAST_ADMIN_MESSAGE = "You can't demote the last admin.";

/** `ADMIN_EMAILS` is comma-separated and compared case-insensitively. */
export function parseAdminEmails(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isConfiguredAdminEmail(email: string | null | undefined, env: NodeJS.ProcessEnv = process.env): boolean {
  if (!email) return false;
  return parseAdminEmails(env.ADMIN_EMAILS).has(email.trim().toLowerCase());
}

function logRoleFailure(what: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[roles] ${what} failed; treating the user as a non-admin: ${message}\n`);
}

export async function getUserRole(userId: string): Promise<UserRole> {
  try {
    const { rows } = await query<{ role: string }>("select role from users where id = $1", [userId]);
    return rows[0]?.role === "admin" ? "admin" : "user";
  } catch (error) {
    logRoleFailure("Reading a role", error);
    return "user";
  }
}

/** Promotes the account when its email is in `ADMIN_EMAILS`. Only ever promotes. */
export async function promoteIfConfiguredAdmin(userId: string, email: string | null | undefined): Promise<boolean> {
  if (!isConfiguredAdminEmail(email)) return false;
  try {
    const { rowCount } = await query("update users set role = 'admin' where id = $1 and role <> 'admin'", [userId]);
    return (rowCount ?? 0) > 0;
  } catch (error) {
    logRoleFailure("Promoting a configured admin", error);
    return false;
  }
}

/**
 * Sets a user's role. Refuses to demote the last admin, checked inside the same transaction
 * (with the admin rows locked) so two admins demoting each other at once can't both succeed.
 * Returns false when the user doesn't exist.
 */
export async function setUserRole(userId: string, role: UserRole): Promise<boolean> {
  return withTransaction(async (client) => {
    if (role === "user") {
      const { rows } = await client.query<{ id: string }>("select id from users where role = 'admin' for update");
      if (rows.length === 1 && rows[0].id === userId) throw new Error(LAST_ADMIN_MESSAGE);
    }
    const { rowCount } = await client.query("update users set role = $2 where id = $1", [userId, role]);
    return (rowCount ?? 0) > 0;
  });
}
