"use client";

import { SearchX } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { EmptyState } from "@/components/domain/empty-state";
import { ProjectShell } from "@/components/shell/project-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProject } from "@/store/use-project";

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const { projectId } = useParams<{ projectId: string }>();
  const { project, loaded } = useProject(projectId);

  if (!loaded) {
    return (
      <div className="mx-auto max-w-[1180px] space-y-4 p-8">
        <Skeleton className="h-8 w-48 rounded-xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }
  if (!project) {
    return (
      <div className="p-8">
        <EmptyState
          icon={SearchX}
          title="API not found"
          description="It may have been deleted."
          action={
            <Button asChild>
              <Link href="/projects">Back to your APIs</Link>
            </Button>
          }
        />
      </div>
    );
  }
  return <ProjectShell project={project}>{children}</ProjectShell>;
}
