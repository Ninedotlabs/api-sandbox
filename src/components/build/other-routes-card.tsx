"use client";

import { Plus } from "lucide-react";
import { toast } from "sonner";
import { SketchCard } from "@/components/domain/sketch-card";
import { Button } from "@/components/ui/button";
import { createId } from "@/lib/ids";
import { uniquePath } from "@/lib/routes";
import type { Project, Route } from "@/lib/types";
import { useProjectStore } from "@/store/project-store";
import { RouteList } from "./route-list";

export function OtherRoutesCard({ project, routes }: { project: Project; routes: Route[] }) {
  const addRoutes = useProjectStore((s) => s.addRoutes);
  async function addCustom() {
    const route: Route = {
      id: createId("rt"), method: "GET", path: uniquePath(project.routes), modelId: null, action: "custom", description: "New route", filters: [],
    };
    try {
      await addRoutes(project.id, [route]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the route.");
    }
  }
  return (
    <SketchCard className="space-y-3 p-4">
      <h3 className="text-sm font-semibold">Other routes</h3>
      <RouteList project={project} routes={routes} />
      <Button variant="secondary" size="sm" className="rounded-xl" onClick={addCustom}>
        <Plus className="size-4" /> Custom route
      </Button>
    </SketchCard>
  );
}
