/**
 * The MCP server's one route to the network. Every `/api/v1` handler answers `{ data }`
 * on success or `{ error: string }` on failure (see `src/lib/api/respond.ts`); `get`/`post`/
 * `patch`/`put`/`del` unwrap that envelope and throw a plain `Error` carrying the server's own
 * plain-language message on failure - the same contract `src/lib/services/http/client.ts`
 * gives the browser store, so a tool handler that fails surfaces exactly what a person using
 * the app would see, never a stack trace.
 *
 * `callEndpoint` is different on purpose: it drives a *mock* endpoint at `/{slug}/{path}`,
 * which is not `/api/v1` and does not use the `{ data }`/`{ error }` envelope or the bearer
 * token - it is a plain HTTP request against an API someone else's client could make, so this
 * returns the real status, headers and body exactly as they came back.
 */
const FALLBACK_MESSAGE = "Something went wrong. Please try again.";

interface Envelope<T> {
  data?: T;
  error?: string;
}

export interface RawEndpointResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

export interface ApiClient {
  get(path: string): Promise<unknown>;
  post(path: string, body?: unknown): Promise<unknown>;
  patch(path: string, body?: unknown): Promise<unknown>;
  put(path: string, body?: unknown): Promise<unknown>;
  del(path: string, body?: unknown): Promise<unknown>;
  /** Issues a real request against a mock endpoint (`/{slug}/{path}`), not `/api/v1`. */
  callEndpoint(method: string, path: string, options?: { query?: Record<string, string>; body?: unknown }): Promise<RawEndpointResponse>;
}

export function createApiClient(baseUrl: string, token: string): ApiClient {
  const base = baseUrl.replace(/\/+$/, "");

  async function call(method: string, path: string, body?: unknown): Promise<unknown> {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const payload = (await response.json().catch(() => undefined)) as Envelope<unknown> | undefined;
    if (!response.ok) throw new Error(payload?.error ?? FALLBACK_MESSAGE);
    return payload?.data;
  }

  return {
    get: (path) => call("GET", path),
    post: (path, body) => call("POST", path, body),
    patch: (path, body) => call("PATCH", path, body),
    put: (path, body) => call("PUT", path, body),
    del: (path, body) => call("DELETE", path, body),

    async callEndpoint(method, path, options = {}) {
      const url = new URL(`${base}${path}`);
      for (const [key, value] of Object.entries(options.query ?? {})) url.searchParams.set(key, value);

      const response = await fetch(url, {
        method,
        ...(options.body !== undefined
          ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(options.body) }
          : {}),
      });

      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      const text = await response.text();
      let body: unknown = text;
      if (text) {
        try {
          body = JSON.parse(text);
        } catch {
          body = text;
        }
      } else {
        body = undefined;
      }

      return { status: response.status, headers, body };
    },
  };
}
