import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getUserRole } from "@/lib/auth/roles";

/**
 * Server-side admin checks. Only a browser session can act as an admin here - an API token
 * never can (see `docs/superpowers/specs/2026-09-22-admin-dashboard-design.md` §2).
 */
export async function currentAdminId(): Promise<string | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;
  return (await getUserRole(userId)) === "admin" ? userId : null;
}

/** For `/admin` pages: anyone who isn't an admin gets a 404, not a hint that the page exists. */
export async function requireAdminPage(): Promise<string> {
  const adminId = await currentAdminId();
  if (!adminId) notFound();
  return adminId;
}
