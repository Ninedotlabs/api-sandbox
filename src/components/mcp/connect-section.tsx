"use client";

import { CodePanel } from "@/components/domain/code-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { deployedAddCommand, deployedDesktopConfig, localAddCommand, localDesktopConfig } from "@/lib/mcp-snippets";

/**
 * The two ways to point a Claude client at this deployment's MCP server: local (stdio, via
 * `src/mcp/stdio.ts`) or deployed (Streamable HTTP, via `src/app/api/mcp/route.ts`). `origin`
 * comes from the server component that renders this (`src/app/mcp/page.tsx`, via
 * `next/headers`), so the deployed snippet is immediately usable against whatever host the
 * page is actually being viewed on.
 */
export function ConnectSection({ origin }: { origin: string }) {
  return (
    <Tabs defaultValue="local" className="gap-3">
      <TabsList variant="line" className="border-b border-line">
        <TabsTrigger value="local">Local (stdio)</TabsTrigger>
        <TabsTrigger value="deployed">Deployed (HTTP)</TabsTrigger>
      </TabsList>

      <TabsContent value="local" className="space-y-3">
        <p className="text-sm text-ink-2">
          Run <code className="font-mono text-ink">npm run build:mcp</code> first - it&apos;s a separate manual build step that compiles
          the stdio entry point to <code className="font-mono text-ink">./dist/mcp/stdio.js</code>, and the command below will fail
          until that exists.
        </p>
        <CodePanel code={localAddCommand()} language="text" title="TERMINAL" />
        <p className="text-sm text-ink-2">Or add it to Claude Desktop&apos;s config directly:</p>
        <CodePanel code={localDesktopConfig()} language="json" title="claude_desktop_config.json" />
      </TabsContent>

      <TabsContent value="deployed" className="space-y-3">
        <p className="text-sm text-ink-2">Points a Claude client at this deployment&apos;s own MCP endpoint over HTTP - no build step needed.</p>
        <CodePanel code={deployedAddCommand(origin)} language="text" title="TERMINAL" />
        <p className="text-sm text-ink-2">Or add it to Claude Desktop&apos;s config directly:</p>
        <CodePanel code={deployedDesktopConfig(origin)} language="json" title="claude_desktop_config.json" />
      </TabsContent>
    </Tabs>
  );
}
