/**
 * Shared response and error-handling helpers for the `/api/v1` management API.
 *
 * Every route returns `{ data }` on success or `{ error: string }` on failure, using one of:
 * 200/201 success, 400 validation, 404 unknown id, 409 conflict, 500 unexpected.
 *
 * The `pg` (and `mock`) services don't carry typed `NotFoundError`/`ConflictError` classes -
 * every expected failure surfaces as a plain `Error`. `handle` below recognises the finite,
 * known set of "not found" and "conflict" messages the services actually throw today and maps
 * them to 404/409. This is deliberately default-safe rather than default-permissive: any
 * `Error` whose message isn't on one of those two allow-lists becomes a generic 500, never
 * its own message. That matters because `friendlyDbError` (see `src/lib/db/errors.ts`) falls
 * back to returning an unrecognised driver error unchanged when its pg code isn't one it
 * knows - a connection failure, an auth failure, a SQL syntax error - and that raw `Error`
 * must never reach a client verbatim. Route-level input validation (zod schemas in the route
 * handlers themselves) is unaffected - those call `fail(400, ...)` directly and never go
 * through this fallback. Anything that isn't even an `Error` also becomes a generic 500,
 * since we can't vouch for a value we didn't throw ourselves.
 */
import type { ZodError } from "zod";

export function ok<T>(data: T, status = 200): Response {
  return Response.json({ data }, { status });
}

export function fail(status: number, message: string): Response {
  return Response.json({ error: message }, { status });
}

/** The finite set of "unknown id" messages the `pg`/`mock` services throw today. */
const NOT_FOUND_MESSAGES = new Set([
  "This API no longer exists.",
  "This model no longer exists.",
  "This route no longer exists.",
  "This record no longer exists.",
]);

/** The finite set of conflict messages the `pg`/`mock` services throw today. */
const CONFLICT_MESSAGES = new Set([
  "Another API already uses this address.",
  "Something with this name or address already exists.",
  "A model with this name already exists.",
  "Two routes can't share the same method and path.",
]);

const GENERIC_500 = "Something went wrong. Please try again.";

/**
 * Runs `fn`, catching anything it throws. A known not-found/conflict message maps to
 * 404/409. Everything else - any other `Error` (including one carrying raw driver text that
 * slipped past `friendlyDbError`), a thrown string, or any other thrown value - becomes a
 * generic 500 rather than being forwarded to the client. Default-safe, not
 * default-permissive: an allow-list decides what's shown, not a deny-list.
 */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof Error) {
      if (NOT_FOUND_MESSAGES.has(error.message)) return fail(404, error.message);
      if (CONFLICT_MESSAGES.has(error.message)) return fail(409, error.message);
    }
    return fail(500, GENERIC_500);
  }
}

/** The request body, or `undefined` when it's missing or isn't valid JSON - never throws. */
export async function readJson(req: Request): Promise<unknown> {
  return req.json().catch(() => undefined);
}

/** The first zod issue's own (already plain-language) message, naming the offending field. */
export function firstIssue(error: ZodError, fallback = "This value isn't valid."): string {
  return error.issues[0]?.message ?? fallback;
}
