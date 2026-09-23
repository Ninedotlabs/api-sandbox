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
 * 2. The gate turns on automatically once the complete Google/Auth.js configuration is
 *    present. `AUTH_REQUIRED=true` can force it on, while `AUTH_REQUIRED=false` is an
 *    explicit break-glass bypass for recovering from a bad OAuth deployment.
 *
 * On top of that, `auth()` is wrapped in try/catch: a broken adapter or misconfigured
 * credentials must send a visitor to `/sign-in`, never crash into an error page - the
 * whole point of gating this behind a flag is to make that failure mode recoverable.
 */
// `/` is the public landing page: gating it would hide the product from everyone who
// does not already have an account.
const EXEMPT_PATHS = ["/", "/sign-in"];
const REQUIRED_AUTH_ENV = ["AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET", "AUTH_SECRET"] as const;

export function isAuthRequired(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.AUTH_REQUIRED === "true") return true;
  if (env.AUTH_REQUIRED === "false") return false;
  return REQUIRED_AUTH_ENV.every((key) => Boolean(env[key]?.trim()));
}

function isExempt(pathname: string): boolean {
  return EXEMPT_PATHS.some((path) => pathname === path);
}

export default async function proxy(request: NextRequest) {
  if (!isAuthRequired()) return NextResponse.next();

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

  const signInUrl = new URL("/sign-in", request.url);
  signInUrl.searchParams.set("callbackUrl", `${pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(signInUrl);
}

export const config = {
  // The app's own icons are excluded alongside `favicon.ico`: a browser fetches them
  // without a session, and a 307 to /sign-in means no icon at all in the tab.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon.svg|apple-icon).*)"],
};
