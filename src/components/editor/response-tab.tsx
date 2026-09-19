"use client";

import { CodePanel } from "@/components/domain/code-panel";
import { StatusLine } from "@/components/domain/status-line";
import { exampleResponse } from "@/lib/examples";
import type { Project, Route } from "@/lib/types";

/** What a caller gets back from this endpoint, as the mock engine would answer it. */
export function ResponseTab({ project, route }: { project: Project; route: Route }) {
  const result = exampleResponse(route, project);
  return (
    <div className="space-y-3">
      <StatusLine status={result.status} />
      {result.body === null ? (
        <CodePanel code="(empty: 204 No Content)" language="text" title="EXAMPLE RESPONSE" />
      ) : (
        <CodePanel code={JSON.stringify(result.body, null, 2)} language="json" title="EXAMPLE RESPONSE" />
      )}
    </div>
  );
}
