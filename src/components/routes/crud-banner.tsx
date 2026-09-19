"use client";

import { Wand2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { countLabel } from "@/lib/format";
import { pluralize } from "@/lib/slug";
import type { Model, Project } from "@/lib/types";
import { useProjectStore } from "@/store/project-store";
import { CrudGeneratorDialog } from "./crud-generator-dialog";

export function CrudBanner({ project, model }: { project: Project; model: Model }) {
  const [open, setOpen] = useState(false);
  const addRoutes = useProjectStore((s) => s.addRoutes);
  const router = useRouter();

  if (project.routes.some((r) => r.modelId === model.id) || model.fields.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 rounded-[10px] border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center">
      <Wand2 className="size-5 shrink-0 text-primary" />
      <div className="flex-1">
        <p className="font-medium">Create ready-made endpoints for {model.name}?</p>
        <p className="text-sm text-muted-foreground">
          {`We'll set up the 5 standard ways to list, get, add, update and delete ${pluralize(model.name)}.`}
        </p>
      </div>
      <Button onClick={() => setOpen(true)}>Create endpoints</Button>
      {open && (
        <CrudGeneratorDialog
          project={project}
          model={model}
          open={open}
          onOpenChange={setOpen}
          onGenerate={async (routes) => {
            await addRoutes(project.id, routes);
            toast.success(`${countLabel(routes.length, "endpoint")} created`, {
              action: { label: "View routes", onClick: () => router.push(`/projects/${project.id}/routes`) },
            });
          }}
        />
      )}
    </div>
  );
}
