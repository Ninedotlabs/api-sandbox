"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Kicker } from "@/components/domain/kicker";
import { LifecycleGuide } from "@/components/editor/lifecycle-guide";
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

  if (selection?.kind === "resource") return <p className="p-6 text-sm text-ink-3">Resource editor (Task 6)</p>;
  if (selection?.kind === "endpoint") return <p className="p-6 text-sm text-ink-3">Endpoint editor (Task 6)</p>;

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

// The console pane lands in Task 7.
function ConsolePanel() {
  return (
    <div className="p-4">
      <Kicker>Console</Kicker>
      <p className="mt-2 text-sm text-ink-3">The console lands next.</p>
    </div>
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
