"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { AiEditPanel } from "@/components/ai/ai-edit-panel";
import { AiGeneratePanel } from "@/components/ai/ai-generate-panel";
import { ConsolePanel } from "@/components/console/console-panel";
import { ContextMenuTarget } from "@/components/domain/context-menu-target";
import { EndpointEditor } from "@/components/editor/endpoint-editor";
import { LifecycleGuide } from "@/components/editor/lifecycle-guide";
import { NewResourcePanel } from "@/components/editor/new-resource-panel";
import { ResourceEditor } from "@/components/editor/resource-editor";
import { ApiTree, type WorkspaceMode } from "@/components/rail/api-tree";
import { WorkspaceShell } from "@/components/shell/workspace-shell";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { backgroundItems } from "@/lib/context-menu-items";
import { createId } from "@/lib/ids";
import { buildChecklist } from "@/lib/onboarding";
import { uniquePath } from "@/lib/routes";
import type { Route } from "@/lib/types";
import { useProjectStore } from "@/store/project-store";
import { useUiStore } from "@/store/ui-store";

function Editor({ mode, onModeChange }: { mode: WorkspaceMode; onModeChange: (mode: WorkspaceMode) => void }) {
  const router = useRouter();
  const { project, selection, select, loadInConsole, setConsoleOpen, setRailOpen } = useWorkspace();
  const addRoutes = useProjectStore((s) => s.addRoutes);
  // Select the stored value only; a `?? {}` inside the selector would return a new object every render.
  const progress = useUiStore((s) => s.progress[project.id]);

  const addResource = () => onModeChange("new-resource");

  async function newEndpoint() {
    const route: Route = {
      id: createId("rt"),
      method: "GET",
      path: uniquePath(project.routes),
      modelId: null,
      action: "custom",
      description: "",
      filters: [],
    };
    try {
      await addRoutes(project.id, [route]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the endpoint.");
      return;
    }
    select({ kind: "endpoint", id: route.id });
  }

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
    <ContextMenuTarget
      items={backgroundItems({
        kind: "workspace",
        onNewResource: addResource,
        onNewEndpoint: () => void newEndpoint(),
        onGenerateWithAI: () => onModeChange("ai"),
      })}
      asChild
    >
      <div>
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
      </div>
    </ContextMenuTarget>
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
