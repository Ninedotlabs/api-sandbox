"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { MethodBadge } from "@/components/domain/method-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { buildCrudRoutes, crudOptions, type CrudAction } from "@/lib/crud";
import { countLabel } from "@/lib/format";
import { createId } from "@/lib/ids";
import { uniquePath } from "@/lib/routes";
import type { Model, Project, Route } from "@/lib/types";
import { useProjectStore } from "@/store/project-store";
import { RouteList } from "./route-list";

export function ResourceRoutesPanel({ project, model }: { project: Project; model: Model }) {
  const addRoutes = useProjectStore((s) => s.addRoutes);
  const routes = project.routes.filter((r) => r.modelId === model.id);
  const options = crudOptions(model);
  const exists = (o: (typeof options)[number]) => project.routes.some((r) => r.method === o.method && r.path === o.path);
  const missing = options.filter((o) => !exists(o));
  const [selected, setSelected] = useState<CrudAction[]>(() => missing.map((o) => o.action));
  const [busy, setBusy] = useState(false);
  const effective = selected.filter((a) => missing.some((o) => o.action === a));

  async function addStandard() {
    if (effective.length === 0) return;
    setBusy(true);
    try {
      const next = buildCrudRoutes(model, effective, project.routes);
      await addRoutes(project.id, next);
      toast.success(`${countLabel(next.length, "endpoint")} created`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the endpoints.");
    } finally {
      setBusy(false);
    }
  }

  async function addCustom() {
    const route: Route = {
      id: createId("rt"),
      method: "GET",
      path: uniquePath(project.routes),
      modelId: model.id,
      action: "custom",
      description: "New route",
      filters: [],
    };
    try {
      await addRoutes(project.id, [route]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the route.");
    }
  }

  return (
    <div className="space-y-4">
      <RouteList project={project} routes={routes} />
      {missing.length > 0 && (
        <div className="rounded-xl border border-dashed border-line-strong p-3">
          <p className="mb-2 text-sm font-medium">Add standard endpoints</p>
          <ul className="flex flex-wrap gap-2">
            {options.map((o) => {
              const already = exists(o);
              const id = `std-${model.id}-${o.action}`;
              return (
                <li key={o.action}>
                  <label htmlFor={id} className="inline-flex cursor-pointer items-center gap-2 rounded-full border bg-surface px-3 py-1 text-xs has-[:checked]:border-primary">
                    <Checkbox
                      id={id}
                      aria-label={o.label}
                      checked={already || selected.includes(o.action)}
                      disabled={already}
                      onCheckedChange={(v) =>
                        setSelected((s) => (v === true ? [...s, o.action] : s.filter((a) => a !== o.action)))
                      }
                    />
                    <MethodBadge method={o.method} />
                    {o.label}
                  </label>
                </li>
              );
            })}
          </ul>
          <Button size="sm" className="mt-3 rounded-xl" disabled={effective.length === 0 || busy} onClick={addStandard}>
            Add {countLabel(effective.length, "endpoint")}
          </Button>
        </div>
      )}
      <Button variant="secondary" size="sm" className="rounded-xl" onClick={addCustom}>
        <Plus className="size-4" /> Custom route
      </Button>
    </div>
  );
}
