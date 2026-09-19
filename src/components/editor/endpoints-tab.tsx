"use client";

import { useState } from "react";
import { toast } from "sonner";
import { MethodLabel, PathText } from "@/components/domain/method-label";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { buildCrudRoutes, crudOptions, type CrudAction } from "@/lib/crud";
import { countLabel } from "@/lib/format";
import type { Model } from "@/lib/types";
import { useProjectStore } from "@/store/project-store";

/** The five standard endpoints for a resource, plus whatever custom ones it already has. */
export function EndpointsTab({ model }: { model: Model }) {
  const { project, select } = useWorkspace();
  const addRoutes = useProjectStore((s) => s.addRoutes);
  const [ticked, setTicked] = useState<CrudAction[]>(["list", "get", "create", "update", "delete"]);
  const [busy, setBusy] = useState(false);

  const options = crudOptions(model);
  const exists = (method: string, path: string) => project.routes.some((r) => r.method === method && r.path === path);
  const selected = options.filter((o) => !exists(o.method, o.path) && ticked.includes(o.action)).map((o) => o.action);
  const custom = project.routes.filter((r) => r.modelId === model.id && r.action === "custom");

  async function createSelected() {
    const routes = buildCrudRoutes(model, selected, project.routes);
    if (routes.length === 0) return;
    setBusy(true);
    try {
      await addRoutes(project.id, routes);
      toast(`${countLabel(routes.length, "endpoint")} created`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the endpoints.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <p className="text-[13px] text-ink-2">
          {"Standard endpoints for this resource. The ones that already exist are ticked and locked."}
        </p>
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
          {options.map((o) => {
            const already = exists(o.method, o.path);
            const id = `crud-${model.id}-${o.action}`;
            return (
              <li key={o.action}>
                <label htmlFor={id} className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-panel-strong/50">
                  <Checkbox
                    id={id}
                    aria-label={o.label}
                    checked={already || ticked.includes(o.action)}
                    disabled={already}
                    onCheckedChange={(v) =>
                      setTicked((s) => (v === true ? [...s, o.action] : s.filter((a) => a !== o.action)))
                    }
                  />
                  <MethodLabel method={o.method} />
                  <PathText path={o.path} className="text-[13px] text-ink" />
                  <span className="ml-auto truncate text-[13px] text-ink-3">{o.label}</span>
                </label>
              </li>
            );
          })}
        </ul>
        <Button size="sm" disabled={selected.length === 0 || busy} onClick={createSelected}>
          Create selected
        </Button>
      </section>

      <section className="space-y-3">
        <h3 className="kicker">Custom endpoints</h3>
        {custom.length === 0 ? (
          <p className="text-[13px] text-ink-3">{"None yet. Add one with + Endpoint in the rail."}</p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
            {custom.map((route) => (
              <li key={route.id} className="flex items-center gap-3 px-3 py-2">
                <MethodLabel method={route.method} />
                <PathText path={route.path} className="text-[13px] text-ink" />
                <span className="truncate text-[13px] text-ink-3">{route.description}</span>
                <Button
                  variant="outline"
                  size="xs"
                  className="ml-auto"
                  onClick={() => select({ kind: "endpoint", id: route.id })}
                >
                  Open
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
