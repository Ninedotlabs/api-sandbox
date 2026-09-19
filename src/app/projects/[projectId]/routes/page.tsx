"use client";

import { Plus, Route as RouteIcon, Wand2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/domain/empty-state";
import { PageHeader } from "@/components/domain/page-header";
import { CrudGeneratorDialog } from "@/components/routes/crud-generator-dialog";
import { RouteRow } from "@/components/routes/route-row";
import { Button } from "@/components/ui/button";
import { countLabel } from "@/lib/format";
import { createId } from "@/lib/ids";
import { groupRoutes, missingCrud, uniquePath } from "@/lib/routes";
import { baseUrl } from "@/lib/slug";
import type { Model, Route } from "@/lib/types";
import { useProjectStore } from "@/store/project-store";
import { useCurrentProject } from "@/store/use-project";

export default function RoutesPage() {
  const project = useCurrentProject();
  const addRoutes = useProjectStore((s) => s.addRoutes);
  const deleteRoute = useProjectStore((s) => s.deleteRoute);
  const restoreRoute = useProjectStore((s) => s.restoreRoute);
  const router = useRouter();
  const [crudModel, setCrudModel] = useState<Model | null>(null);
  const base = baseUrl(project.slug);

  async function newRoute() {
    const route: Route = {
      id: createId("rt"),
      method: "GET",
      path: uniquePath(project.routes),
      modelId: null,
      action: "custom",
      description: "New route",
      filters: [],
    };
    try {
      await addRoutes(project.id, [route]);
      router.push(`/projects/${project.id}/routes/${route.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the route.");
    }
  }

  async function remove(route: Route) {
    try {
      const removed = await deleteRoute(project.id, route.id);
      toast("Route deleted", {
        action: {
          label: "Undo",
          onClick: () =>
            void restoreRoute(project.id, removed).catch((e) => {
              toast.error(e instanceof Error ? e.message : "Could not undo.");
            }),
        },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete the route.");
    }
  }

  if (project.models.length === 0 && project.routes.length === 0) {
    return (
      <EmptyState
        icon={RouteIcon}
        title="No routes yet"
        description={"Routes come from models. Create a model first, then we'll build its endpoints."}
        action={
          <Button asChild>
            <Link href={`/projects/${project.id}/models`}>Go to models</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="Routes"
        description="Routes are the web addresses apps call to read and change your data."
        actions={
          <Button onClick={newRoute}>
            <Plus className="size-4" /> New route
          </Button>
        }
      />
      <div className="space-y-8">
        {groupRoutes(project).map((group) => (
          <section key={group.key} className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold">
                {group.title} <span className="text-sm font-normal text-muted-foreground">· {countLabel(group.routes.length, "route")}</span>
              </h2>
              {group.model && missingCrud(group.model, project.routes) && (
                <Button variant="outline" size="sm" onClick={() => setCrudModel(group.model)}>
                  <Wand2 className="size-4" /> Add standard endpoints
                </Button>
              )}
            </div>
            {group.routes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No routes for this model yet.</p>
            ) : (
              <ul className="space-y-2">
                {group.routes.map((r) => (
                  <RouteRow key={r.id} route={r} base={base} href={`/projects/${project.id}/routes/${r.id}`} onDelete={() => remove(r)} />
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
      {crudModel && (
        <CrudGeneratorDialog
          project={project}
          model={crudModel}
          open
          onOpenChange={(open) => !open && setCrudModel(null)}
          onGenerate={async (routes) => {
            await addRoutes(project.id, routes);
            toast.success(`${countLabel(routes.length, "endpoint")} created`);
          }}
        />
      )}
    </div>
  );
}
