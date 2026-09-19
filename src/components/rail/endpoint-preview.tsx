import { CodePanel } from "@/components/domain/code-panel";
import { exampleRequestText } from "@/lib/examples";
import type { Project, Route } from "@/lib/types";

/** The example request for an endpoint, shown in the rail's hover preview. */
export function EndpointPreview({ route, project }: { route: Route; project: Project }) {
  return <CodePanel code={exampleRequestText(route, project)} language="http" title="EXAMPLE REQUEST" className="border-0" />;
}
