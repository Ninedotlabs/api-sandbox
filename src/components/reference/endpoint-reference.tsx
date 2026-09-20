import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { CodePanel } from "@/components/domain/code-panel";
import { MethodLabel, PathText } from "@/components/domain/method-label";
import type { DocEndpoint } from "@/lib/docs";
import { exampleRequestText } from "@/lib/examples";
import { routeParams } from "@/lib/paths";
import type { Project } from "@/lib/types";

/** One endpoint: method + path, description, example request and response — both on the light `CodePanel` tone. */
export function EndpointReference({ endpoint, project }: { endpoint: DocEndpoint; project: Project }) {
  const { route, response } = endpoint;
  const params = routeParams(route.path);
  return (
    <div id={route.id} className="scroll-mt-20 space-y-3 rounded-lg border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center gap-3">
        <MethodLabel method={route.method} />
        <PathText path={route.path} className="text-sm text-ink" />
        <Link
          href={`/projects/${project.id}?endpoint=${route.id}`}
          className="ml-auto inline-flex items-center gap-1 text-sm text-accent hover:underline"
        >
          {"Open in console"} <ArrowUpRight className="size-3.5" />
        </Link>
      </div>
      <p className="text-sm text-ink-2">{route.description || "Untitled endpoint"}</p>
      {params.length > 0 && (
        <p className="text-xs text-ink-3">
          {"Replace "}
          {params.map((p) => (
            <code key={p} className="mx-0.5 font-mono text-ink-2">
              {`:${p}`}
            </code>
          ))}
          {" with the id of the record."}
        </p>
      )}
      {route.filters.length > 0 && (
        <p className="text-xs text-ink-3">
          {"Filter with "}
          <code className="font-mono text-ink-2">{`?${route.filters[0]}=value`}</code>
          {". Available: "}
          {route.filters.join(", ")}
          {"."}
        </p>
      )}
      <CodePanel code={exampleRequestText(route, project)} language="http" title="EXAMPLE REQUEST" />
      {response.body === null ? (
        <CodePanel code="(empty: 204 No Content)" language="text" title="EXAMPLE RESPONSE" />
      ) : (
        <CodePanel code={JSON.stringify(response.body, null, 2)} language="json" title={`EXAMPLE RESPONSE · ${response.status}`} />
      )}
    </div>
  );
}
