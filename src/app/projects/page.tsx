"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { NewProjectCard } from "@/components/dashboard/new-project-card";
import { ProjectCard } from "@/components/domain/project-card";
import { DashboardHeader } from "@/components/shell/dashboard-header";
import { Skeleton } from "@/components/ui/skeleton";
import { countLabel } from "@/lib/format";
import type { CreateProjectInput } from "@/lib/services";
import { useProjectStore } from "@/store/project-store";
import { useProjects } from "@/store/use-project";

export default function ProjectsPage() {
  const { projects, loaded } = useProjects();
  const createProject = useProjectStore((s) => s.createProject);
  const router = useRouter();

  async function create(input: CreateProjectInput) {
    const project = await createProject(input);
    toast.success(`${project.name} is ready`);
    router.push(`/projects/${project.id}`);
  }

  return (
    <div className="min-h-screen">
      <DashboardHeader />
      <main className="mx-auto max-w-[1180px] px-4 py-6 md:px-8">
        {!loaded ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-44 rounded-2xl" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="mx-auto max-w-md space-y-6 pt-10 text-center">
            <h1 className="font-script text-4xl">{"Let's make an API"}</h1>
            <p className="text-sm text-ink-muted">Name it, pick a starting point, and we build the endpoints for you.</p>
            <div className="text-left">
              <NewProjectCard existingProjects={projects} onCreate={create} autoFocus />
            </div>
          </div>
        ) : (
          <>
            <h1 className="mb-4 text-xl font-semibold">
              Your APIs <span className="text-ink-muted">· {countLabel(projects.length, "API")}</span>
            </h1>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <NewProjectCard existingProjects={projects} onCreate={create} />
              {projects.map((p) => (
                <ProjectCard key={p.id} project={p} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
