import { withTransaction } from "@/lib/db/client";

/**
 * Claim-on-first-sign-in (see `docs/superpowers/specs/2026-09-21-google-auth-design.md` §4).
 *
 * There is exactly one person's data in this database today, and they are about to
 * become user number one. On that first successful sign-in, every project that has no
 * owner yet becomes theirs. Guarded, in one transaction, by counting `users`: if more
 * than one user already exists, an ownerless project is left exactly as it is and the
 * situation is logged rather than guessed at - silently handing one person's data to
 * another account is the worst failure this feature can have.
 *
 * Safe to call more than once: after the first successful claim there are no ownerless
 * projects left, so a repeat call updates zero rows.
 */
export async function claimOwnerlessProjects(userId: string): Promise<void> {
  await withTransaction(async (client) => {
    const { rows: userRows } = await client.query<{ count: string }>("select count(*) from users");
    const userCount = Number(userRows[0].count);

    if (userCount !== 1) {
      const { rows: orphanRows } = await client.query<{ count: string }>(
        "select count(*) from projects where owner_id is null",
      );
      const orphanCount = Number(orphanRows[0].count);
      if (orphanCount > 0) {
        console.warn(
          `[auth] Skipped claiming ${orphanCount} ownerless project(s): ${userCount} users already exist. ` +
            "Claiming is only automatic for the very first user; reassign ownership by hand if needed.",
        );
      }
      return;
    }

    await client.query("update projects set owner_id = $1 where owner_id is null", [userId]);
  });
}
