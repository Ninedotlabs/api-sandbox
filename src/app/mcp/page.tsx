import { headers } from "next/headers";
import { Kicker } from "@/components/domain/kicker";
import { ConnectSection } from "@/components/mcp/connect-section";
import { TokenPanel } from "@/components/mcp/token-panel";
import { ToolsTable } from "@/components/mcp/tools-table";
import { WhatToAsk } from "@/components/mcp/what-to-ask";
import { TopBar } from "@/components/shell/top-bar";
import { resolveOrigin } from "@/lib/mcp-snippets";

export const metadata = {
  title: "MCP - Universal API",
  description: "Connect a Claude client to Universal API over MCP.",
};

export default async function McpPage() {
  const headersList = await headers();
  const origin = resolveOrigin(headersList.get("host"), headersList.get("x-forwarded-proto"));

  return (
    <div className="min-h-screen">
      <TopBar />
      <main className="mx-auto max-w-4xl space-y-12 px-4 py-10 md:px-6">
        <div className="space-y-2">
          <Kicker>MCP</Kicker>
          <h1 className="text-2xl font-semibold text-ink">Connect Claude to Universal API</h1>
          <p className="text-ink-2">
            Every operation Universal API exposes to a person - creating projects, designing resources, adding endpoints, seeding and
            editing records, generating or editing an API from a description, and calling the mock endpoints themselves - is also
            exposed to Claude as an MCP tool. This page connects a client and documents exactly what it can do.
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-ink">Connect</h2>
          <ConnectSection origin={origin} />
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-ink">Token</h2>
          {/* Called directly rather than as `<TokenPanel />`: an async Server Component
              works either way in a real RSC render, but calling it lets `TokenPanel` be
              exercised on its own with a plain `render(await TokenPanel())` in its own
              test, and avoids a nested-async-component render error under the client-only
              renderer this page's own test uses. */}
          {await TokenPanel()}
          <p className="text-sm text-ink-3">
            Sign-in is deferred for this product. Anyone holding the token can read and modify every project through it, exactly as
            they could through this app&apos;s own interface - treat it as a password, not a convenience.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-ink">Tools</h2>
          <p className="text-sm text-ink-2">
            Generated from the server&apos;s own tool list, so this table can&apos;t describe a tool that doesn&apos;t exist or miss
            one that does.
          </p>
          <ToolsTable />
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-ink">What to ask</h2>
          <p className="text-sm text-ink-2">Plain-English requests a Claude client connected this way can carry out end to end:</p>
          <WhatToAsk />
        </section>
      </main>
    </div>
  );
}
