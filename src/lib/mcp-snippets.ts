/**
 * The copy-paste connect snippets on `/mcp` (see `src/app/mcp/page.tsx`). Pure string
 * builders so they're testable without rendering anything, mirroring `src/lib/snippets.ts`.
 *
 * Every snippet carries `TOKEN_PLACEHOLDER`, never a real token: the page's Connect section
 * is static, server-rendered markup, and the whole point of the Token section (see
 * `src/components/mcp/token-panel.tsx`) is that the real value never sits in page source.
 * A person copies the command once, then swaps the placeholder for the token they copy
 * separately.
 */
export const TOKEN_PLACEHOLDER = "<your-token>";

const STDIO_ENTRYPOINT = "./dist/mcp/stdio.js";
const DEFAULT_HOST = "localhost:3000";

/**
 * Builds the deployed snippet's origin from the current request's own `host` (and, if
 * present, `x-forwarded-proto`) headers - see `src/app/mcp/page.tsx`, which reads them via
 * `next/headers`. That way the snippet is immediately usable against whatever host the page
 * is actually being viewed on, local or deployed, without guessing at a domain.
 */
export function resolveOrigin(host: string | null, forwardedProto: string | null): string {
  const safeHost = host ?? DEFAULT_HOST;
  const isLocal = safeHost.startsWith("localhost") || safeHost.startsWith("127.0.0.1");
  const proto = forwardedProto ?? (isLocal ? "http" : "https");
  return `${proto}://${safeHost}`;
}

/** `claude mcp add` for the local stdio transport - requires `npm run build:mcp` first. */
export function localAddCommand(): string {
  return `claude mcp add universal-api -e UNIVERSAL_API_TOKEN=${TOKEN_PLACEHOLDER} -- node ${STDIO_ENTRYPOINT}`;
}

/** Claude Desktop's config block for the local stdio transport. */
export function localDesktopConfig(): string {
  return JSON.stringify(
    {
      mcpServers: {
        "universal-api": {
          command: "node",
          args: [STDIO_ENTRYPOINT],
          env: { UNIVERSAL_API_TOKEN: TOKEN_PLACEHOLDER },
        },
      },
    },
    null,
    2,
  );
}

/** `claude mcp add` for the deployed Streamable HTTP transport at `<origin>/api/mcp`. */
export function deployedAddCommand(origin: string): string {
  return `claude mcp add --transport http universal-api ${origin}/api/mcp --header "Authorization: Bearer ${TOKEN_PLACEHOLDER}"`;
}

/** Claude Desktop's config block for the deployed HTTP transport. */
export function deployedDesktopConfig(origin: string): string {
  return JSON.stringify(
    {
      mcpServers: {
        "universal-api": {
          type: "http",
          url: `${origin}/api/mcp`,
          headers: { Authorization: `Bearer ${TOKEN_PLACEHOLDER}` },
        },
      },
    },
    null,
    2,
  );
}
