"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense } from "react";
import { Kicker } from "@/components/domain/kicker";
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
      <div className="mx-auto max-w-xl space-y-3 px-6 py-16 text-center">
        <Kicker>Not found</Kicker>
        <h1 className="text-xl font-semibold text-ink">Project not found</h1>
        <p className="text-sm text-ink-3">{"It may have been deleted."}</p>
        <Button asChild className="mt-2">
          <Link href="/projects">Back to your projects</Link>
        </Button>
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
