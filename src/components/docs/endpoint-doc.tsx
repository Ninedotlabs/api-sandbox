import { Play } from "lucide-react";
import Link from "next/link";
import { CodeBlock } from "@/components/domain/code-block";
import { MethodBadge } from "@/components/domain/method-badge";
import { UrlSegments } from "@/components/domain/url-segments";
import { Button } from "@/components/ui/button";
import type { DocEndpoint } from "@/lib/docs";
import { routeParams } from "@/lib/paths";

export function EndpointDoc({ endpoint, slug, tryHref }: { endpoint: DocEndpoint; slug: string; tryHref: string }) {
  const { route, request, response } = endpoint;
  const params = routeParams(route.path);
  return (
    <div className="space-y-4 rounded-2xl border bg-card p-5 shadow-card">
      <div className="flex flex-wrap items-center gap-3">
        <MethodBadge method={route.method} showLabel />
        <UrlSegments slug={slug} tail={route.path} />
        <Button variant="outline" size="sm" className="ml-auto" asChild>
          <Link href={tryHref}>
            <Play className="size-4" /> Try it
          </Link>
        </Button>
      </div>
      <p className="font-medium">{route.description || "Untitled route"}</p>
      {params.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Replace {params.map((p) => <code key={p} className="mx-0.5 font-mono text-foreground">:{p}</code>)} with the record&apos;s id.
        </p>
      )}
      {route.filters.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Filter with <code className="font-mono text-foreground">?{route.filters[0]}=value</code>. Available:{" "}
          {route.filters.join(", ")}.
        </p>
      )}
      {request && (
        <div className="space-y-1.5">
          <h4 className="text-sm font-medium">Example request body</h4>
          <CodeBlock code={JSON.stringify(request, null, 2)} />
        </div>
      )}
      <div className="space-y-1.5">
        <h4 className="text-sm font-medium">Example response · {response.status}</h4>
        {response.body === null ? (
          <CodeBlock code="(empty: 204 No Content)" language="text" />
        ) : (
          <CodeBlock code={JSON.stringify(response.body, null, 2)} />
        )}
      </div>
    </div>
  );
}
