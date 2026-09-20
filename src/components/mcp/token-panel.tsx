import { Kicker } from "@/components/domain/kicker";
import { maskToken } from "@/lib/mcp-token";
import { CopyTokenButton } from "./copy-token-button";

/**
 * A server component so the real `UNIVERSAL_API_TOKEN` is read on the server and never
 * serialized into the page - only `maskToken`'s output (a fixed-shape string with a handful
 * of real characters) crosses into rendered markup. Copying the real value is a deliberate,
 * separate action (`CopyTokenButton`, `src/app/api/mcp/token/route.ts`), not something this
 * component ever has in hand to pass down.
 */
export async function TokenPanel() {
  const token = process.env.UNIVERSAL_API_TOKEN;

  if (!token) {
    return (
      <div className="space-y-2">
        <Kicker>Token</Kicker>
        <p className="text-sm text-ink-3">
          No token is configured for this deployment. Set <code className="font-mono text-ink-2">UNIVERSAL_API_TOKEN</code> in the
          environment before connecting an MCP client.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Kicker>Token</Kicker>
      <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-panel px-3 py-2">
        <code className="font-mono text-sm text-ink">{maskToken(token)}</code>
        <CopyTokenButton />
      </div>
    </div>
  );
}
