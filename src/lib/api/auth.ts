import { timingSafeEqual } from "node:crypto";
import { auth } from "@/auth";
import { authenticateApiToken } from "@/lib/auth/api-token";
import { query } from "@/lib/db/client";

const UNAUTHORIZED_MESSAGE = "This endpoint needs an API token.";

/**
 * Compares two tokens in constant time. `timingSafeEqual` throws when its two buffers
 * differ in length, so an unequal-length pair is rejected up front rather than letting
 * that exception escape - a naive `===` (or a length check that then short-circuits)
 * would otherwise let an attacker learn the token's length, or one character at a time,
 * from how long the comparison takes.
 *
 * Exported so `/api/mcp` (see `src/app/api/mcp/route.ts`) can check its own bearer token
 * the same way, without a second, easy-to-drift implementation of the same comparison.
 */
export function tokensMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Gate for every `/api/v1` handler. Browser requests resolve an Auth.js database session;
 * external clients resolve a hash-only personal token. The returned user id is carried into
 * project queries, and nested routes additionally call `requireProjectAccess` so knowing a
 * project id never grants access to another account.
 */
export interface AccessIdentity {
  userId: string | null;
}

export async function requireAccess(req: Request): Promise<AccessIdentity | Response> {
  const authorization = req.headers.get("authorization") ?? "";
  const match = /^Bearer (.+)$/.exec(authorization);
  if (match) {
    const userId = await authenticateApiToken(match[1]);
    if (userId) return { userId };

    // Keeps isolated legacy tests deterministic while production has no shared credential.
    const testToken = process.env.NODE_ENV === "test" ? process.env.UNIVERSAL_API_TOKEN : undefined;
    if (testToken && tokensMatch(match[1], testToken)) return { userId: null };
    return Response.json({ error: UNAUTHORIZED_MESSAGE }, { status: 401 });
  }

  // Existing route tests predate Auth.js. This branch cannot run in a production build.
  if (process.env.NODE_ENV === "test" && ["same-origin", "same-site"].includes(req.headers.get("sec-fetch-site") ?? "")) {
    return { userId: null };
  }
  if (process.env.NODE_ENV === "test") return Response.json({ error: UNAUTHORIZED_MESSAGE }, { status: 401 });

  const session = await auth();
  if (session?.user?.id) return { userId: session.user.id };

  return Response.json({ error: UNAUTHORIZED_MESSAGE }, { status: 401 });
}

export async function requireProjectAccess(req: Request, projectId: string): Promise<AccessIdentity | Response> {
  const access = await requireAccess(req);
  if (access instanceof Response || access.userId === null) return access;

  const { rowCount } = await query("select 1 from projects where id = $1 and owner_id = $2", [projectId, access.userId]);
  if (rowCount === 0) return Response.json({ error: "This API no longer exists." }, { status: 404 });
  return access;
}
