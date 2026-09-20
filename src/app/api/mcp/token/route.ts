/**
 * Serves the real `UNIVERSAL_API_TOKEN` value to a same-origin fetch from the `/mcp` docs
 * page's copy button (see `src/components/mcp/copy-token-button.tsx`) - deliberately, on
 * click, and nowhere else. The page itself only ever renders the masked form
 * (`src/lib/mcp-token.ts`), so the full token never sits in page source for a viewer without
 * access; this route exists precisely so the copy action can fetch the real value without
 * the server component that renders the page ever passing it to client-side markup.
 *
 * Gated the same way as every `/api/v1` route (`requireAccess`, see `src/lib/api/auth.ts`):
 * this is a new, separate route from the MCP transport at `src/app/api/mcp/route.ts` and
 * does not change it. It carries no extra privilege of its own - anyone who can reach this
 * same-origin page can already read and write everything the token can, since sign-in is
 * deferred; masking on the page protects against accidental exposure (view source, a shared
 * screenshot, a search-engine crawl), not against a person who already has the app open.
 */
import { requireAccess } from "@/lib/api/auth";
import { fail, handle, ok } from "@/lib/api/respond";

export const runtime = "nodejs";

export async function GET(req: Request): Promise<Response> {
  return handle(async () => {
    const denied = requireAccess(req);
    if (denied) return denied;

    const token = process.env.UNIVERSAL_API_TOKEN;
    if (!token) return fail(404, "No token is configured for this deployment.");
    return ok({ token });
  });
}
