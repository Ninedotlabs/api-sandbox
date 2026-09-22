import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import { recordActivity } from "@/lib/activity/record";
import { claimOwnerlessProjects } from "@/lib/auth/claim-owner";
import { pgAdapter } from "@/lib/auth/pg-adapter";
import { getUserRole, promoteIfConfiguredAdmin, type UserRole } from "@/lib/auth/roles";

declare module "next-auth" {
  interface Session {
    user: { role?: UserRole } & DefaultSession["user"];
  }
}

/**
 * Auth.js v5 configuration (see `docs/superpowers/specs/2026-09-21-google-auth-design.md`).
 *
 * - Google is the only provider. `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` are read
 *   automatically by Auth.js's environment-variable inference (`AUTH_<PROVIDER>_ID`);
 *   they are never read directly here, so they never end up in a log line by accident.
 * - Database sessions, not JWT: the `sessions` table already exists and a database
 *   session can be revoked (delete the row) whereas a JWT cannot be, short of rotating
 *   `AUTH_SECRET` and invalidating every session at once.
 * - `pages.signIn` points at our own sign-in page (`src/app/sign-in/page.tsx`) instead of
 *   Auth.js's default page, which doesn't match this app's visual system.
 * - `events.createUser` fires exactly once per new user, right after the adapter inserts
 *   their row - the natural hook for "on the first successful sign-in" claiming.
 * - `events.signIn` promotes an account listed in `ADMIN_EMAILS` and records the sign-in in
 *   the activity log. Role is read with its own query in the session callback rather than
 *   through the adapter, so a database without `0003_admin.sql` still signs people in (see
 *   `docs/superpowers/specs/2026-09-22-admin-dashboard-design.md` §2).
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: pgAdapter,
  session: { strategy: "database" },
  providers: [Google],
  pages: { signIn: "/sign-in", error: "/sign-in" },
  callbacks: {
    async session({ session, user }) {
      // Auth.js intentionally exposes only name/email/image by default. The server-side
      // management API needs the stable adapter id to scope projects and credentials.
      session.user.id = user.id;
      // Only used to show the Admin link; every admin page and API re-checks on the server.
      session.user.role = await getUserRole(user.id);
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      if (!user.id) return;
      await claimOwnerlessProjects(user.id);
    },
    async signIn({ user, account, isNewUser }) {
      if (!user.id) return;
      await promoteIfConfiguredAdmin(user.id, user.email);
      await recordActivity({
        actorUserId: user.id,
        action: "auth.sign_in",
        channel: "auth",
        targetType: "user",
        targetId: user.id,
        metadata: { provider: account?.provider ?? null, newUser: Boolean(isNewUser) },
      });
    },
  },
});
