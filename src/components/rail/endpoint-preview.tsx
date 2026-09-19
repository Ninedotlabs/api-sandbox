import { CodePanel } from "@/components/domain/code-panel";
import { exampleRequest } from "@/lib/examples";
import { baseUrl } from "@/lib/slug";
import type { Project, Route } from "@/lib/types";

/** The example request for an endpoint, shown in the rail's hover preview. */
export function EndpointPreview({ route, project }: { route: Route; project: Project }) {
  const body = exampleRequest(route, project);
  const lines = [`${route.method} ${baseUrl(project.slug)}${route.path}`];
  if (body) {
    lines.push("Content-Type: application/json", "", JSON.stringify(body, null, 2));
  }
  return <CodePanel code={lines.join("\n")} language="http" title="EXAMPLE REQUEST" className="border-0" />;
}
