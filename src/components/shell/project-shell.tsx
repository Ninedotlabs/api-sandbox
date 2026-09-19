"use client";

import type { Project } from "@/lib/types";
import { Breadcrumb } from "./breadcrumb";
import { CommandPalette } from "./command-palette";
import { ProjectTabs } from "./project-tabs";
import { TopBar } from "./top-bar";

export function ProjectShell({ project, children }: { project: Project; children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <TopBar showSearch />
      <div className="mx-auto max-w-[1180px] px-4 md:px-8">
        <div className="flex flex-col gap-4 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <Breadcrumb project={project} />
          <ProjectTabs projectId={project.id} />
        </div>
        <main className="pb-16">{children}</main>
      </div>
      <CommandPalette project={project} />
    </div>
  );
}
