"use client";

import { CodePanel } from "@/components/domain/code-panel";
import { RouteEditor } from "@/components/routes/route-editor";
import { exampleRequestText } from "@/lib/examples";
import type { Project, Route } from "@/lib/types";

interface Props {
  project: Project;
  route: Route;
  onSave: (route: Route) => Promise<void> | void;
}

/** How the endpoint is shaped, and what a call to it looks like on the wire. */
export function RequestTab({ project, route, onSave }: Props) {
  return (
    <div className="space-y-4">
      <RouteEditor project={project} route={route} onSave={onSave} />
      <section className="space-y-2">
        <h3 className="kicker">Example request</h3>
        <CodePanel code={exampleRequestText(route, project)} language="http" title="EXAMPLE REQUEST" />
      </section>
    </div>
  );
}
