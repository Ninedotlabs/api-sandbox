"use client";

import { MoreHorizontal, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/domain/page-header";
import { CrudBanner } from "@/components/routes/crud-banner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Model, Project } from "@/lib/types";
import { useProjectStore } from "@/store/project-store";
import { ModelFieldTable } from "./model-field-table";
import { SampleDataTable } from "./sample-data-table";

export function ModelEditor({ project, model }: { project: Project; model: Model }) {
  const saveModel = useProjectStore((s) => s.saveModel);
  const deleteModel = useProjectStore((s) => s.deleteModel);
  const restoreProject = useProjectStore((s) => s.restoreProject);
  const router = useRouter();

  async function handleSave(next: Model) {
    try {
      await saveModel(project.id, next);
      toast.success(`${next.name} saved`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the model.");
    }
  }

  async function handleDelete() {
    const snapshot = await deleteModel(project.id, model.id);
    router.push(`/projects/${project.id}/models`);
    toast(`${model.name} deleted`, {
      action: { label: "Undo", onClick: () => void restoreProject(snapshot) },
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={model.name}
        description={`Describe the fields every ${model.name.toLowerCase()} has. Think of them as columns in a spreadsheet.`}
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Model actions">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="text-destructive" onSelect={handleDelete}>
                <Trash2 className="size-4" /> Delete model
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />
      <CrudBanner project={project} model={model} />
      <Tabs defaultValue="fields">
        <TabsList>
          <TabsTrigger value="fields">Fields</TabsTrigger>
          <TabsTrigger value="sample">Sample data</TabsTrigger>
        </TabsList>
        <TabsContent value="fields" className="mt-4">
          <ModelFieldTable key={JSON.stringify(model.fields)} model={model} models={project.models} onSave={handleSave} />
        </TabsContent>
        <TabsContent value="sample" className="mt-4">
          <SampleDataTable projectId={project.id} model={model} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
