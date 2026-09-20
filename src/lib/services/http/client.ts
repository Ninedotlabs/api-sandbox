/**
 * The one place `http/*.ts` talks to the network. Every `/api/v1` handler answers
 * `{ data }` or `{ error: string }` (see `src/lib/api/respond.ts`); this unwraps that
 * envelope and throws a plain `Error` carrying the server's own plain-language message on
 * failure, so the store's existing `catch (e) { e instanceof Error ? e.message : ... }`
 * blocks surface it unchanged - exactly as a `mock`/`pg` service throwing `new Error(...)`
 * already does today.
 */
const FALLBACK_MESSAGE = "Something went wrong. Please try again.";

interface Envelope<T> {
  data?: T;
  error?: string;
}

async function readEnvelope<T>(response: Response): Promise<Envelope<T> | undefined> {
  return response.json().catch(() => undefined);
}

function withJsonHeaders(init?: RequestInit): RequestInit {
  return { ...init, headers: { "Content-Type": "application/json", ...(init?.headers as Record<string, string> | undefined) } };
}

/** Fetches `path`, returning `data` on success and throwing the server's `error` string
 * (or a generic fallback, if the body wasn't readable) on any non-2xx status. */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, withJsonHeaders(init));
  const payload = await readEnvelope<T>(response);
  if (!response.ok) throw new Error(payload?.error ?? FALLBACK_MESSAGE);
  return payload?.data as T;
}

/** Same as `apiFetch`, but a 404 resolves to `null` rather than throwing - for
 * `ProjectService.get`, whose `mock`/`pg` counterparts return `null` for an unknown id
 * instead of raising. */
export async function apiFetchNullable<T>(path: string, init?: RequestInit): Promise<T | null> {
  const response = await fetch(path, withJsonHeaders(init));
  if (response.status === 404) return null;
  const payload = await readEnvelope<T>(response);
  if (!response.ok) throw new Error(payload?.error ?? FALLBACK_MESSAGE);
  return (payload?.data as T | undefined) ?? null;
}
