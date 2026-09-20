"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ContextMenuTarget } from "@/components/domain/context-menu-target";
import { Kicker } from "@/components/domain/kicker";
import { NEW_PROJECT_NAME_ID, NewProjectRow } from "@/components/projects/new-project-row";
import { ProjectList } from "@/components/projects/project-list";
import { TopBar } from "@/components/shell/top-bar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { backgroundItems } from "@/lib/context-menu-items";
import { countLabel } from "@/lib/format";
import type { CreateProjectInput } from "@/lib/services";
import { useProjectStore } from "@/store/project-store";
import { useProjects } from "@/store/use-project";

export default function ProjectsPage() {
  const { projects, loaded, loadError, retry } = useProjects();
  const createProject = useProjectStore((s) => s.createProject);
  const router = useRouter();

  async function create(input: CreateProjectInput) {
    const project = await createProject(input);
    toast.success(`${project.name} is ready`);
    router.push(`/projects/${project.id}`);
  }

  const backgroundMenuItems = backgroundItems({
    kind: "projects",
    onNewProject: () => document.getElementById(NEW_PROJECT_NAME_ID)?.focus(),
  });

  return (
    <div className="min-h-screen">
      <TopBar />
      <ContextMenuTarget items={backgroundMenuItems} asChild>
        <main className="mx-auto max-w-5xl space-y-4 px-4 py-8 md:px-6">
          <div className="flex items-baseline gap-3">
            <h1 className="text-xl font-semibold">Projects</h1>
            {loaded && <Kicker>{countLabel(projects.length, "project")}</Kicker>}
          </div>
          <div className="overflow-hidden rounded-lg border border-line bg-surface">
            <NewProjectRow existingProjects={projects} onCreate={create} autoFocus={loaded && projects.length === 0} />
          </div>
          {loadError ? (
            <div role="alert" className="rounded-lg border border-danger/40 bg-danger/5 p-3">
              <p className="text-sm text-danger">Your account could not be reached. {loadError}</p>
              <Button variant="outline" size="sm" className="mt-2 rounded-md" onClick={() => void retry()}>
                Retry
              </Button>
            </div>
          ) : !loaded ? (
            <Skeleton className="h-40 w-full rounded-lg" />
          ) : projects.length === 0 ? (
            <p className="px-1 text-sm text-ink-3">Define a resource, mock its endpoints, send a request.</p>
          ) : (
            <ProjectList projects={projects} />
          )}
        </main>
      </ContextMenuTarget>
    </div>
  );
}
