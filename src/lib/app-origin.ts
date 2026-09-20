/**
 * Resolves the origin the app shows in copyable snippets (curl/JS/Python, MCP connect
 * commands) and in the UI (base-URL pill, console strip), instead of a hardcoded
 * `localhost:3000` that would be silently wrong on any deployment other than local dev.
 *
 * Precedence:
 *   1. `NEXT_PUBLIC_APP_URL`, if set - an explicit override the owner can set per-environment
 *      in the Vercel dashboard.
 *   2. In the browser, `window.location.origin` - simply the truth, and needs no configuration.
 *   3. `https://$NEXT_PUBLIC_VERCEL_URL`, if present - so a Vercel deployment is correct with
 *      zero setup.
 *   4. `http://localhost:3000`.
 *
 * IMPORTANT: `NEXT_PUBLIC_*` env vars are inlined into the bundle at BUILD TIME by Next.js,
 * not read at request time (see the Next.js docs on bundling environment variables). So
 * changing `NEXT_PUBLIC_APP_URL` in the Vercel dashboard has no effect until the next
 * redeploy. Rule 2 exists precisely to keep the common case (nobody has set the var, or it's
 * stale) correct anyway: `window.location.origin` is read live, in the visitor's own browser,
 * every time the page loads.
 */

/** Strips a trailing slash and, for a scheme-less value, adds one - `http://` for a bare
 *  localhost host so local dev keeps working over plain HTTP, `https://` for everything else. */
function normalize(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return trimmed;
  const isLocal = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(trimmed);
  return `${isLocal ? "http" : "https"}://${trimmed}`;
}

/** The full origin, e.g. `https://api-sandbox-eight.vercel.app`. */
export function getAppOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return normalize(configured);

  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/+$/, "");
  }

  const vercelUrl = process.env.NEXT_PUBLIC_VERCEL_URL;
  if (vercelUrl) return normalize(vercelUrl);

  return "http://localhost:3000";
}

/** The origin without its scheme, e.g. `api-sandbox-eight.vercel.app` - for display spots
 *  (the base-URL pill, the console strip) that show the scheme separately or not at all. */
export function getAppOriginDisplay(): string {
  return getAppOrigin().replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
}
