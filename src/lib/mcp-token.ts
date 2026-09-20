/**
 * Masks `UNIVERSAL_API_TOKEN` for display on `/mcp` (see `src/components/mcp/token-panel.tsx`).
 * Keeps a recognisable prefix (e.g. "ua_") and the last four characters so someone can tell
 * which token they're looking at at a glance, but always renders the same fixed number of
 * bullets in between - never the token's real length, which is itself information a viewer
 * without access shouldn't get for free.
 */
const BULLET_COUNT = 8;
const SUFFIX_LENGTH = 4;
const PREFIX_PATTERN = /^([a-zA-Z0-9]+_)/;

export function maskToken(token: string): string {
  const prefixMatch = PREFIX_PATTERN.exec(token);
  const prefix = prefixMatch ? prefixMatch[1] : "";
  const rest = token.slice(prefix.length);
  const bullets = "•".repeat(BULLET_COUNT);

  if (rest.length <= SUFFIX_LENGTH) return `${prefix}${bullets}`;
  return `${prefix}${bullets}${rest.slice(-SUFFIX_LENGTH)}`;
}
