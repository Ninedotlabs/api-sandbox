"use client";

import { Plus, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { MethodBadge } from "@/components/domain/method-badge";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import type { Project } from "@/lib/types";
import { useProjectStore } from "@/store/project-store";
import { useUiStore } from "@/store/ui-store";
import { PROJECT_NAV, navHref } from "./nav-items";

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
    <CommandDialog open={open} onOpenChange={setOpen} title="Search" description="Jump to a page, model or route" className="rounded-2xl">
      <CommandInput placeholder="Search pages, models and routes…" />
      <CommandList>
        <CommandEmpty>Nothing found.</CommandEmpty>
        <CommandGroup heading="Pages">
          {PROJECT_NAV.map(({ segment, label, icon: Icon }) => (
            <CommandItem key={label} value={`page ${label}`} onSelect={() => go(navHref(project.id, segment))}>
              <Icon className="size-4" /> {label}
            </CommandItem>
          ))}
          <CommandItem value="page Settings" onSelect={() => go(`/projects/${project.id}/settings`)}>
            <Settings className="size-4" /> Settings
          </CommandItem>
        </CommandGroup>
        {project.models.length > 0 && (
          <CommandGroup heading="Models">
            {project.models.map((m) => (
              <CommandItem key={m.id} value={`model ${m.name}`} onSelect={() => go(`/projects/${project.id}?model=${m.id}`)}>
                {m.name}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {project.routes.length > 0 && (
          <CommandGroup heading="Routes">
            {project.routes.map((r) => (
              <CommandItem
                key={r.id}
                value={`route ${r.method} ${r.path} ${r.description}`}
                onSelect={() => go(`/projects/${project.id}/console?route=${r.id}`)}
              >
                <MethodBadge method={r.method} tooltip={false} />
                <span className="truncate">{r.description}</span>
                <code className="ml-auto font-mono text-xs text-muted-foreground">{r.path}</code>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {projects.length > 1 && (
          <CommandGroup heading="Your APIs">
            {projects
              .filter((p) => p.id !== project.id)
              .map((p) => (
                <CommandItem key={p.id} value={`api ${p.name}`} onSelect={() => go(`/projects/${p.id}`)}>
                  {p.name}
                </CommandItem>
              ))}
          </CommandGroup>
        )}
        <CommandGroup heading="Actions">
          <CommandItem value="action new api" onSelect={() => go("/projects")}>
            <Plus className="size-4" /> New API
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
