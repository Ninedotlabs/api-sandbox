"use client";

import { toast } from "sonner";
import { InlineEdit } from "@/components/domain/inline-edit";
import { TwoStepButton } from "@/components/domain/two-step-button";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { countLabel } from "@/lib/format";
import { resourcePath } from "@/lib/slug";
import type { Model } from "@/lib/types";
import { validateModelName } from "@/lib/validation";
import { useProjectStore } from "@/store/project-store";
import { DataTab } from "./data-tab";
import { EditorHeader } from "./editor-header";
import { EndpointsTab } from "./endpoints-tab";
import { SchemaTab } from "./schema-tab";

/** Everything about one resource: its schema, its endpoints and its mock data. */
export function ResourceEditor({ model }: { model: Model }) {
  const { project, select } = useWorkspace();
  const saveModel = useProjectStore((s) => s.saveModel);
  const deleteModel = useProjectStore((s) => s.deleteModel);
  const restoreModel = useProjectStore((s) => s.restoreModel);

  const endpoints = project.routes.filter((r) => r.modelId === model.id).length;

  async function rename(name: string) {
    try {
      await saveModel(project.id, { ...model, name });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not rename the resource.";
      toast.error(message);
      throw new Error(message);
    }
  }

  async function remove() {
    try {
      const removed = await deleteModel(project.id, model.id);
      select(null);
      toast(`${model.name} deleted`, {
        action: {
          label: "Undo",
          onClick: () =>
            void restoreModel(project.id, removed).catch((e) =>
              toast.error(e instanceof Error ? e.message : "Could not undo."),
            ),
        },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete the resource.");
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <EditorHeader
        kicker="Resource"
        title={
          <InlineEdit
            value={model.name}
            ariaLabel="Resource name"
            validate={(name) => validateModelName(name, project.models, model.id)}
            onSave={rename}
          />
        }
        description={
          <span className="flex flex-wrap items-center gap-1.5">
            <code className="font-mono text-ink">{resourcePath(model.name)}</code>
            <span aria-hidden>·</span>
            <span>{countLabel(model.fields.length, "field")}</span>
            <span aria-hidden>·</span>
            <span>{countLabel(endpoints, "endpoint")}</span>
          </span>
        }
        actions={<TwoStepButton label="Delete" confirmLabel="Sure? Delete" onConfirm={() => void remove()} />}
      />

      <Tabs defaultValue="schema" className="flex-1">
        <div className="border-b border-line px-6">
          <TabsList variant="line">
            <TabsTrigger value="schema">Schema</TabsTrigger>
            <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
            <TabsTrigger value="data">Data</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="schema" className="p-6">
          <SchemaTab model={model} />
        </TabsContent>
        <TabsContent value="endpoints" className="p-6">
          <EndpointsTab model={model} />
        </TabsContent>
        <TabsContent value="data" className="p-6">
          <DataTab model={model} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
