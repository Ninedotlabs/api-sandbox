"use client";

import { toast } from "sonner";
import { ModelFieldTable } from "@/components/models/model-field-table";
import type { Model, Project } from "@/lib/types";
import { useProjectStore } from "@/store/project-store";

export function ResourceFieldsPanel({ project, model }: { project: Project; model: Model }) {
  const saveModel = useProjectStore((s) => s.saveModel);
  return (
    <ModelFieldTable
      key={JSON.stringify(model.fields)}
      model={model}
      models={project.models}
      onSave={async (next) => {
        try {
          await saveModel(project.id, next);
          toast.success(`${next.name} saved`);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Could not save the model.");
        }
      }}
    />
  );
}
