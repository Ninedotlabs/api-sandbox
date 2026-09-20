import { timingSafeEqual } from "node:crypto";

const UNAUTHORIZED_MESSAGE = "This endpoint needs an API token.";

/**
 * Compares two tokens in constant time. `timingSafeEqual` throws when its two buffers
 * differ in length, so an unequal-length pair is rejected up front rather than letting
 * that exception escape - a naive `===` (or a length check that then short-circuits)
 * would otherwise let an attacker learn the token's length, or one character at a time,
 * from how long the comparison takes.
 */
function tokensMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Gate for every `/api/v1` handler. Returns `null` when the request may proceed, or a
 * ready-to-return 401 `Response` when it may not.
 *
 * Same-origin/same-site browser requests (per `Sec-Fetch-Site`) are let through with no
 * credential: sign-in is deliberately deferred, and the app is currently open. This is
 * NOT a security boundary against a non-browser client - `Sec-Fetch-Site` is just a
 * header, and any client that isn't a real browser can set it to whatever it likes.
 * With auth deferred, anyone who can reach the deployment can already modify its (mock,
 * non-confidential) data; a script that skips this header simply has to send a bearer
 * token instead. Real auth, when it arrives, will scope queries by the `owner_id` column
 * that already exists on `projects`, rather than by trusting this header.
 *
 * External clients (MCP included) authenticate with `Authorization: Bearer
 * <UNIVERSAL_API_TOKEN>`, compared in constant time so the token can't be recovered a
 * character at a time via response-timing analysis.
 */
export function requireAccess(req: Request): Response | null {
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite === "same-origin" || fetchSite === "same-site") return null;

  const authorization = req.headers.get("authorization") ?? "";
  const match = /^Bearer (.+)$/.exec(authorization);
  const expected = process.env.UNIVERSAL_API_TOKEN;
  if (match && expected && tokensMatch(match[1], expected)) return null;

  return Response.json({ error: UNAUTHORIZED_MESSAGE }, { status: 401 });
}
