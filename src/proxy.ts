import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";

/**
 * Sign-in gate for app pages (see `docs/superpowers/specs/2026-09-21-google-auth-design.md`
 * §3 and the lockout warning in the task brief).
 *
 * This is `proxy.ts`, not `middleware.ts`: Next.js 16 renamed the file convention (see
 * `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`),
 * and the `middleware.js` doc in this install is marked deprecated in favour of it.
 *
 * Two structural guarantees, both load-bearing:
 *
 * 1. `config.matcher` excludes `/api/*` entirely, so this function never even runs for
 *    `/api/<slug>/*` (a project's public mock endpoints - must never redirect, 401, or
 *    receive a cookie), nor for `/api/auth/*`, `/api/v1/*`, `/api/mcp`, or `/api/ai/*`.
 *    That is a framework-level exclusion, not a runtime check that could have a bug.
 * 2. Gated behind `AUTH_REQUIRED` (default OFF). Flipping it on requires a real, verified
 *    Google sign-in first - see the task report. With it off, this file changes nothing
 *    about how the app behaves today.
 *
 * On top of that, `auth()` is wrapped in try/catch: a broken adapter or misconfigured
 * credentials must send a visitor to `/sign-in`, never crash into an error page - the
 * whole point of gating this behind a flag is to make that failure mode recoverable.
 */
const EXEMPT_PATHS = ["/sign-in"];

function isExempt(pathname: string): boolean {
  return EXEMPT_PATHS.some((path) => pathname === path);
}

export default async function proxy(request: NextRequest) {
  if (process.env.AUTH_REQUIRED !== "true") return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (isExempt(pathname)) return NextResponse.next();

  try {
    const session = await auth();
    if (session?.user) return NextResponse.next();
  } catch (error) {
    // Deliberately `process.stderr.write`, not `console.*`: every `console` method is
    // patched by Next's own dev instrumentation
    // (`node_modules/next/dist/server/node-environment-extensions/console-dim.external.js`)
    // to consult an `AsyncLocalStorage`-backed store for log dimming, and that store's
    // `.run()` throws its own "not available" invariant outside of a real request-render
    // context - exactly the kind of failure this catch block exists to survive. Writing to
    // stderr directly still reaches the server log without going through that patch.
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[proxy] auth() failed; failing toward sign-in rather than an error page: ${message}\n`);
  }

  return NextResponse.redirect(new URL("/sign-in", request.url));
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
