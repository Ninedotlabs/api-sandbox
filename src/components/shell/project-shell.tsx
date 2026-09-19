"use client";

import type { Project } from "@/lib/types";
import { AppSidebar } from "./app-sidebar";
import { CommandPalette } from "./command-palette";
import { Logo } from "./logo";
import { TopBar } from "./top-bar";

export function ProjectShell({ project, children }: { project: Project; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-surface md:flex">
        <div className="flex h-14 items-center border-b px-4">
          <Logo />
        </div>
        <div className="flex-1 overflow-y-auto">
          <AppSidebar projectId={project.id} />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar project={project} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
      <CommandPalette project={project} />
    </div>
  );
}
