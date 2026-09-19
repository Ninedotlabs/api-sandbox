"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConsolePanel } from "@/components/console/console-panel";
import { EndpointEditor } from "@/components/editor/endpoint-editor";
import { LifecycleGuide } from "@/components/editor/lifecycle-guide";
import { ResourceEditor } from "@/components/editor/resource-editor";
import { ApiTree } from "@/components/rail/api-tree";
import { WorkspaceShell } from "@/components/shell/workspace-shell";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { buildChecklist } from "@/lib/onboarding";
import { useUiStore } from "@/store/ui-store";

function Editor({ onAddResource }: { onAddResource: () => void }) {
  const router = useRouter();
  const { project, selection, select, loadInConsole, setConsoleOpen, setRailOpen } = useWorkspace();
  const progress = useUiStore((s) => s.progress[project.id] ?? {});

  // The new-resource row lives in the rail, which is a drawer on narrow screens.
  function addResource() {
    setRailOpen(true);
    onAddResource();
  }

  const model = selection?.kind === "resource" ? project.models.find((m) => m.id === selection.id) : null;
  if (model) return <ResourceEditor key={model.id} model={model} />;
  const route = selection?.kind === "endpoint" ? project.routes.find((r) => r.id === selection.id) : null;
  if (route) return <EndpointEditor key={route.id} route={route} />;

  return (
    <LifecycleGuide
      steps={buildChecklist(project, progress)}
      actions={{
        define: addResource,
        mock: () => {
          const model = project.models[0];
          if (model) select({ kind: "resource", id: model.id });
          else addResource();
        },
        request: () => {
          const route = project.routes[0];
          if (route) loadInConsole(route.id);
          setConsoleOpen(true);
        },
        respond: () => router.push(`/projects/${project.id}/reference`),
      }}
    />
  );
}

export default function WorkspacePage() {
  const [creating, setCreating] = useState(false);
  return (
    <WorkspaceShell
      rail={<ApiTree creating={creating} onCreatingChange={setCreating} />}
      editor={<Editor onAddResource={() => setCreating(true)} />}
      console={<ConsolePanel />}
    />
  );
}
