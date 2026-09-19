"use client";

import { SearchX } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense } from "react";
import { EmptyState } from "@/components/domain/empty-state";
import { CommandPalette } from "@/components/shell/command-palette";
import { TopBar } from "@/components/shell/top-bar";
import { WorkspaceProvider } from "@/components/workspace/workspace-context";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProject } from "@/store/use-project";

function LoadingShell() {
  return (
    <div className="space-y-4 p-8">
      <Skeleton className="h-8 w-48 rounded-md" />
      <Skeleton className="h-40 w-full rounded-lg" />
    </div>
  );
}

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const { projectId } = useParams<{ projectId: string }>();
  const { project, loaded } = useProject(projectId);

  if (!loaded) return <LoadingShell />;
  if (!project) {
    return (
      <div className="p-8">
        <EmptyState
          icon={SearchX}
          title="Project not found"
          description="It may have been deleted."
          action={
            <Button asChild>
              <Link href="/projects">Back to your projects</Link>
            </Button>
          }
        />
      </div>
    );
  }
  return (
    <Suspense fallback={<LoadingShell />}>
      <WorkspaceProvider project={project}>
        <TopBar project={project} />
        {children}
        <CommandPalette project={project} />
      </WorkspaceProvider>
    </Suspense>
  );
}
