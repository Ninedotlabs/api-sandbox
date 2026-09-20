/**
 * Pure, side-effect-free config loading for the stdio transport - split out of `stdio.ts` so
 * it can be imported (and tested) without also running the server, which `stdio.ts` does
 * unconditionally at module load, since it's meant only to be run as `node ./dist/mcp/stdio.js`.
 */
import { getAppOrigin } from "../lib/app-origin";

export class MissingTokenError extends Error {}

export interface StdioConfig {
  baseUrl: string;
  token: string;
}

/** Never starts unauthenticated: a missing token is a hard failure, not a warning. */
export function loadConfig(env: Record<string, string | undefined> = process.env): StdioConfig {
  const token = env.UNIVERSAL_API_TOKEN;
  if (!token) {
    throw new MissingTokenError(
      "UNIVERSAL_API_TOKEN is not set. Set it to a valid Universal API token before starting the MCP server.",
    );
  }
  return { baseUrl: env.UNIVERSAL_API_URL ?? getAppOrigin(), token };
}
