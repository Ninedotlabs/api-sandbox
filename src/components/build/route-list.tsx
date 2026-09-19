"use client";

import { Play, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { MethodBadge } from "@/components/domain/method-badge";
import { PathPreview } from "@/components/routes/path-preview";
import { RouteEditor } from "@/components/routes/route-editor";
import { Button } from "@/components/ui/button";
import type { Project, Route } from "@/lib/types";
import { useProjectStore } from "@/store/project-store";

interface Props {
  project: Project;
  routes: Route[];
}

export function RouteList({ project, routes }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const saveRoute = useProjectStore((s) => s.saveRoute);
  const deleteRoute = useProjectStore((s) => s.deleteRoute);
  const restoreRoute = useProjectStore((s) => s.restoreRoute);

  async function remove(route: Route) {
    try {
      const removed = await deleteRoute(project.id, route.id);
      toast("Route deleted", {
        action: {
          label: "Undo",
          onClick: () =>
            void restoreRoute(project.id, removed).catch((e) => toast.error(e instanceof Error ? e.message : "Could not undo.")),
        },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete the route.");
    }
  }

  if (routes.length === 0) return <p className="text-sm text-ink-3">No routes yet.</p>;

  return (
    <ul className="space-y-2">
      {routes.map((route) => {
        const name = route.description || route.path;
        const editing = editingId === route.id;
        return (
          <li key={route.id} className="rounded-xl border bg-surface">
            <div className="flex flex-wrap items-center gap-3 p-3">
              <MethodBadge method={route.method} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{name}</p>
                <p className="truncate text-xs text-ink-3">
                  <PathPreview base="" path={route.path} />
                </p>
              </div>
              <Button variant="ghost" size="sm" className="rounded-xl" aria-label={`Edit ${name}`} onClick={() => setEditingId(editing ? null : route.id)}>
                {editing ? "Close" : "Edit"}
              </Button>
              <Button variant="ghost" size="sm" className="rounded-xl" asChild>
                <Link href={`/projects/${project.id}/console?route=${route.id}`} aria-label={`Test ${name}`}>
                  <Play className="size-4" /> Test
                </Link>
              </Button>
              <Button variant="ghost" size="icon" className="text-destructive" aria-label={`Delete ${name}`} onClick={() => remove(route)}>
                <Trash2 className="size-4" />
              </Button>
            </div>
            {editing && (
              <div className="border-t p-3">
                <RouteEditor
                  key={JSON.stringify(route)}
                  project={project}
                  route={route}
                  onSave={async (next) => {
                    await saveRoute(project.id, next);
                    toast.success("Route saved");
                    setEditingId(null);
                  }}
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
