"use client";

import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { MethodBadge } from "@/components/domain/method-badge";
import { SketchCard } from "@/components/domain/sketch-card";
import { Button } from "@/components/ui/button";
import { countLabel } from "@/lib/format";
import type { Model, Project } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useProjectStore } from "@/store/project-store";
import { ResourceDataPanel } from "./resource-data-panel";
import { ResourceFieldsPanel } from "./resource-fields-panel";
import { ResourceRoutesPanel } from "./resource-routes-panel";

export type Panel = "fields" | "routes" | "data";
const PANELS: { id: Panel; label: string }[] = [
  { id: "fields", label: "Fields" },
  { id: "routes", label: "Routes" },
  { id: "data", label: "Data" },
];

interface Props {
  project: Project;
  model: Model;
  recordCount: number;
  maxCount: number;
  openPanel: Panel | null;
  onToggle: (panel: Panel) => void;
}

export function ResourceCard({ project, model, recordCount, maxCount, openPanel, onToggle }: Props) {
  const deleteModel = useProjectStore((s) => s.deleteModel);
  const restoreModel = useProjectStore((s) => s.restoreModel);
  const routes = project.routes.filter((r) => r.modelId === model.id);
  const fill = maxCount > 0 ? Math.max(4, Math.round((recordCount / maxCount) * 100)) : 0;

  async function remove() {
    try {
      const removed = await deleteModel(project.id, model.id);
      toast(`${model.name} deleted`, {
        action: {
          label: "Undo",
          onClick: () =>
            void restoreModel(project.id, removed).catch((e) => toast.error(e instanceof Error ? e.message : "Could not undo.")),
        },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete the model.");
    }
  }

  return (
    <SketchCard id={`model-${model.id}`} className={cn("animate-in fade-in slide-in-from-bottom-1 duration-200", openPanel && "border-solid border-line bg-card shadow-card")}>
      <div className="flex flex-wrap items-center gap-3 p-4">
        <div className="flex min-w-0 items-center gap-3">
          <h3 className="truncate text-sm font-semibold">{model.name}</h3>
          <div className="flex items-center gap-2">
            <div className="h-2 w-24 overflow-hidden rounded-full bg-soft">
              <div className="h-full rounded-full bg-pastel-violet-ink/70" style={{ width: `${fill}%` }} />
            </div>
            <span className="text-xs text-ink-muted" aria-label={`${recordCount} sample records`}>{recordCount}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-soft px-2 py-0.5 text-[11px] text-ink-muted">{countLabel(model.fields.length, "field")}</span>
          {routes.map((r) => (
            <MethodBadge key={r.id} method={r.method} tooltip={false} />
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1">
          {PANELS.map((p) => (
            <Button
              key={p.id}
              variant="secondary"
              size="sm"
              aria-expanded={openPanel === p.id}
              aria-controls={`model-${model.id}-panel`}
              className={cn("rounded-xl", openPanel === p.id ? "bg-ink text-paper hover:bg-ink/90" : "bg-soft")}
              onClick={() => onToggle(p.id)}
            >
              {p.label}
            </Button>
          ))}
          <Button variant="ghost" size="icon" className="text-destructive" aria-label={`Delete ${model.name}`} onClick={remove}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
      {openPanel && (
        <div id={`model-${model.id}-panel`} className="border-t p-4">
          {openPanel === "fields" && <ResourceFieldsPanel project={project} model={model} />}
          {openPanel === "routes" && <ResourceRoutesPanel project={project} model={model} />}
          {openPanel === "data" && <ResourceDataPanel project={project} model={model} />}
        </div>
      )}
    </SketchCard>
  );
}
