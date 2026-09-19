"use client";

import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { countLabel } from "@/lib/format";
import { pluralize } from "@/lib/slug";
import type { Model, Project } from "@/lib/types";
import { useProjectStore } from "@/store/project-store";
import { ResourceDataPanel } from "./resource-data-panel";
import { ResourceFieldsPanel } from "./resource-fields-panel";
import { ResourceRoutesPanel } from "./resource-routes-panel";

export type Panel = "fields" | "routes" | "data";
const PANELS: { id: Panel; label: string }[] = [
  { id: "fields", label: "Fields" },
  { id: "routes", label: "Routes" },
  { id: "data", label: "Sample data" },
];

interface Props {
  project: Project;
  model: Model;
  recordCount: number;
  maxCount: number;
  openPanel: Panel | null;
  onToggle: (panel: Panel) => void;
}

export function ResourceCard({ project, model, recordCount, openPanel, onToggle }: Props) {
  const deleteModel = useProjectStore((s) => s.deleteModel);
  const restoreModel = useProjectStore((s) => s.restoreModel);
  const routes = project.routes.filter((r) => r.modelId === model.id);
  const one = model.name.toLowerCase();
  const hint =
    model.fields.length === 0
      ? `Press Fields to describe what a ${one} stores.`
      : routes.length === 0
        ? `Press Routes to create the endpoints for ${pluralize(model.name)}.`
        : null;

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
    <article id={`model-${model.id}`} className="animate-in fade-in slide-in-from-bottom-1 rounded-2xl border bg-card shadow-card duration-200">
      <div className="flex flex-wrap items-center gap-4 p-5">
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold">{model.name}</h3>
          <p className="text-sm text-ink-muted">
            <span>{countLabel(model.fields.length, "field")}</span>
            <span aria-hidden> · </span>
            <span>{routes.length === 0 ? "no routes yet" : countLabel(routes.length, "route")}</span>
            <span aria-hidden> · </span>
            <span>{countLabel(recordCount, "sample record")}</span>
          </p>
          {hint && !openPanel && <p className="mt-1 text-sm text-pastel-blue-ink">{hint}</p>}
        </div>
        <div className="flex items-center gap-1.5">
          {PANELS.map((p) => (
            <Button
              key={p.id}
              variant="secondary"
              aria-expanded={openPanel === p.id}
              aria-controls={`model-${model.id}-panel`}
              className="aria-expanded:bg-ink aria-expanded:text-paper aria-expanded:hover:bg-ink/90"
              onClick={() => onToggle(p.id)}
            >
              {p.label}
            </Button>
          ))}
          <Button variant="ghost" size="icon" className="text-ink-muted hover:text-destructive" aria-label={`Delete ${model.name}`} onClick={remove}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
      {openPanel && (
        <div id={`model-${model.id}-panel`} className="border-t p-5">
          {openPanel === "fields" && <ResourceFieldsPanel project={project} model={model} />}
          {openPanel === "routes" && <ResourceRoutesPanel project={project} model={model} />}
          {openPanel === "data" && <ResourceDataPanel project={project} model={model} />}
        </div>
      )}
    </article>
  );
}
