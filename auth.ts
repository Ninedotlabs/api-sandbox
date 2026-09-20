import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { claimOwnerlessProjects } from "@/lib/auth/claim-owner";
import { pgAdapter } from "@/lib/auth/pg-adapter";

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
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: pgAdapter,
  session: { strategy: "database" },
  providers: [Google],
  pages: { signIn: "/sign-in" },
  events: {
    async createUser({ user }) {
      if (!user.id) return;
      await claimOwnerlessProjects(user.id);
    },
  },
});
