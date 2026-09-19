"use client";

import { BookOpen, LayoutPanelLeft, Plus, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { MethodLabel } from "@/components/domain/method-label";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import type { Project } from "@/lib/types";
import { useProjectStore } from "@/store/project-store";
import { useUiStore } from "@/store/ui-store";

export function CommandPalette({ project }: { project: Project }) {
  const open = useUiStore((s) => s.commandOpen);
  const setOpen = useUiStore((s) => s.setCommandOpen);
  const projects = useProjectStore((s) => s.projects);
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(!useUiStore.getState().commandOpen);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Search" description="Jump to a page, resource or endpoint" className="rounded-xl shadow-pop">
      <CommandInput placeholder="Search pages, resources and endpoints…" />
      <CommandList>
        <CommandEmpty>Nothing found.</CommandEmpty>
        <CommandGroup heading="Pages">
          <CommandItem value="page Workspace" onSelect={() => go(`/projects/${project.id}`)}>
            <LayoutPanelLeft className="size-4" /> Workspace
          </CommandItem>
          <CommandItem value="page Reference" onSelect={() => go(`/projects/${project.id}/reference`)}>
            <BookOpen className="size-4" /> Reference
          </CommandItem>
          <CommandItem value="page Settings" onSelect={() => go(`/projects/${project.id}/settings`)}>
            <Settings className="size-4" /> Settings
          </CommandItem>
        </CommandGroup>
        {project.models.length > 0 && (
          <CommandGroup heading="Resources">
            {project.models.map((m) => (
              <CommandItem key={m.id} value={`resource ${m.name}`} onSelect={() => go(`/projects/${project.id}?resource=${m.id}`)}>
                {m.name}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {project.routes.length > 0 && (
          <CommandGroup heading="Endpoints">
            {project.routes.map((r) => (
              <CommandItem
                key={r.id}
                value={`endpoint ${r.method} ${r.path} ${r.description}`}
                onSelect={() => go(`/projects/${project.id}?endpoint=${r.id}`)}
              >
                <MethodLabel method={r.method} />
                <span className="truncate">{r.description}</span>
                <code className="ml-auto font-mono text-xs text-ink-3">{r.path}</code>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {projects.length > 1 && (
          <CommandGroup heading="Projects">
            {projects
              .filter((p) => p.id !== project.id)
              .map((p) => (
                <CommandItem key={p.id} value={`project ${p.name}`} onSelect={() => go(`/projects/${p.id}`)}>
                  {p.name}
                </CommandItem>
              ))}
          </CommandGroup>
        )}
        <CommandGroup heading="Actions">
          <CommandItem value="action new project" onSelect={() => go("/projects")}>
            <Plus className="size-4" /> New project
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
