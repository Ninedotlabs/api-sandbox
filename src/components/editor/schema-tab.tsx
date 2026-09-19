"use client";

import { toast } from "sonner";
import { ModelFieldTable } from "@/components/models/model-field-table";
import { useWorkspace } from "@/components/workspace/workspace-context";
import type { Model } from "@/lib/types";
import { useProjectStore } from "@/store/project-store";

/** The fields of a resource. The table edits a draft; it is remounted once the saved fields change. */
export function SchemaTab({ model }: { model: Model }) {
  const { project } = useWorkspace();
  const saveModel = useProjectStore((s) => s.saveModel);

  async function save(next: Model) {
    try {
      await saveModel(project.id, next);
      toast("Schema saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the schema.");
    }
  }

  return (
    <ModelFieldTable
      key={JSON.stringify(model.fields)}
      model={model}
      models={project.models}
      onSave={save}
    />
  );
}
