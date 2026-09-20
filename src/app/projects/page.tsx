"use client";

import { useRouter } from "next/navigation";
import { Bot, Braces, Globe2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { ContextMenuTarget } from "@/components/domain/context-menu-target";
import { Kicker } from "@/components/domain/kicker";
import { NEW_PROJECT_NAME_ID, NewProjectRow } from "@/components/projects/new-project-row";
import { ProjectList } from "@/components/projects/project-list";
import { DashboardShell } from "@/components/shell/dashboard-shell";
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
    <DashboardShell title="Projects" description="Create, shape and test public mock APIs.">
      <ContextMenuTarget items={backgroundMenuItems} asChild>
        <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-6 md:py-8">
          <section className="overflow-hidden rounded-2xl border border-line bg-slate text-slate-ink shadow-pop">
            <div className="grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-center md:p-8">
              <div className="max-w-2xl space-y-3">
                <Kicker>API workspace</Kicker>
                <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Go from an idea to a testable endpoint in minutes.</h2>
                <p className="max-w-xl text-sm leading-relaxed text-slate-muted md:text-base">
                  Model resources visually, generate them with AI, seed realistic data, then share a live URL with your frontend or test suite.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                {[
                  { icon: Braces, label: "Design" },
                  { icon: Globe2, label: "Publish" },
                  { icon: Bot, label: "Automate" },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="rounded-xl border border-white/10 bg-white/5 px-3 py-4">
                    <Icon className="mx-auto mb-2 size-5 text-method-put-on-slate" aria-hidden />
                    {label}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-baseline gap-3">
                <h1 className="text-xl font-semibold">Your APIs</h1>
                {loaded && <Kicker>{countLabel(projects.length, "project")}</Kicker>}
              </div>
              <p className="mt-1 text-sm text-ink-3">Each project gets a public mock URL and an MCP-accessible management surface.</p>
            </div>
            <Sparkles className="hidden size-5 text-accent sm:block" aria-hidden />
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
            <div className="rounded-xl border border-dashed border-line-strong bg-surface/70 p-8 text-center">
              <Braces className="mx-auto mb-3 size-8 text-accent" aria-hidden />
              <p className="font-medium text-ink">Create your first API above</p>
              <p className="mt-1 text-sm text-ink-3">Define a resource, mock its endpoints, send a request.</p>
            </div>
          ) : (
            <ProjectList projects={projects} />
          )}
        </main>
      </ContextMenuTarget>
    </DashboardShell>
  );
}
