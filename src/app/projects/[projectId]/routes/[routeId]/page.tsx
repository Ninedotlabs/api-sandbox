"use client";

import { Play, SearchX } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { EmptyState } from "@/components/domain/empty-state";
import { PageHeader } from "@/components/domain/page-header";
import { RouteEditor } from "@/components/routes/route-editor";
import { Button } from "@/components/ui/button";
import { useProjectStore } from "@/store/project-store";
import { useCurrentProject } from "@/store/use-project";

export default function RoutePage() {
  const project = useCurrentProject();
  const { routeId } = useParams<{ routeId: string }>();
  const saveRoute = useProjectStore((s) => s.saveRoute);
  const route = project.routes.find((r) => r.id === routeId);
  if (!route) return <EmptyState icon={SearchX} title="Route not found" description="It may have been deleted." />;

  return (
    <div>
      <PageHeader
        title={route.description || "Route"}
        description="Choose what this route does and where it lives."
        actions={
          <Button variant="outline" asChild>
            <Link href={`/projects/${project.id}/console?route=${route.id}`}>
              <Play className="size-4" /> Test this route
            </Link>
          </Button>
        }
      />
      <RouteEditor
        key={JSON.stringify(route)}
        project={project}
        route={route}
        onSave={async (next) => {
          await saveRoute(project.id, next);
          toast.success("Route saved");
        }}
      />
    </div>
  );
}
