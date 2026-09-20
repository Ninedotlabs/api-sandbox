"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AiEditPanel } from "@/components/ai/ai-edit-panel";
import { AiGeneratePanel } from "@/components/ai/ai-generate-panel";
import { ConsolePanel } from "@/components/console/console-panel";
import { EndpointEditor } from "@/components/editor/endpoint-editor";
import { LifecycleGuide } from "@/components/editor/lifecycle-guide";
import { NewResourcePanel } from "@/components/editor/new-resource-panel";
import { ResourceEditor } from "@/components/editor/resource-editor";
import { ApiTree, type WorkspaceMode } from "@/components/rail/api-tree";
import { WorkspaceShell } from "@/components/shell/workspace-shell";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { buildChecklist } from "@/lib/onboarding";
import { useUiStore } from "@/store/ui-store";

function Editor({ mode, onModeChange }: { mode: WorkspaceMode; onModeChange: (mode: WorkspaceMode) => void }) {
  const router = useRouter();
  const { project, selection, select, loadInConsole, setConsoleOpen, setRailOpen } = useWorkspace();
  // Select the stored value only; a `?? {}` inside the selector would return a new object every render.
  const progress = useUiStore((s) => s.progress[project.id]);

  const addResource = () => onModeChange("new-resource");

  if (mode === "ai") {
    return (
      <AiGeneratePanel
        project={project}
        onCancel={() => onModeChange("idle")}
        onApplied={(modelId) => {
          onModeChange("idle");
          select({ kind: "resource", id: modelId });
          setRailOpen(false);
        }}
      />
    );
  }

  if (mode === "ai-edit") {
    return (
      <AiEditPanel
        project={project}
        onCancel={() => onModeChange("idle")}
        onApplied={(modelId) => {
          onModeChange("idle");
          if (modelId) {
            select({ kind: "resource", id: modelId });
            setRailOpen(false);
          }
        }}
      />
    );
  }

  if (mode === "new-resource") {
    return (
      <NewResourcePanel
        project={project}
        onCancel={() => onModeChange("idle")}
        onCreated={(model) => {
          onModeChange("idle");
          select({ kind: "resource", id: model.id });
          setRailOpen(false);
        }}
      />
    );
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
        generate: () => onModeChange("ai"),
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
  const [mode, setMode] = useState<WorkspaceMode>("idle");
  return (
    <WorkspaceShell
      rail={<ApiTree mode={mode} onModeChange={setMode} />}
      editor={<Editor mode={mode} onModeChange={setMode} />}
      console={<ConsolePanel />}
    />
  );
}
