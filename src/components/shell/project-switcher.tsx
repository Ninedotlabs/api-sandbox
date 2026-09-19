"use client";

import { ChevronsUpDown, Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Project } from "@/lib/types";
import { useProjectStore } from "@/store/project-store";

export function ProjectSwitcher({ project }: { project: Project }) {
  const projects = useProjectStore((s) => s.projects);
  const others = projects.filter((p) => p.id !== project.id);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 rounded-md px-2 font-semibold text-ink">
          {project.name}
          <ChevronsUpDown className="size-3.5 text-ink-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 rounded-xl">
        {others.length > 0 && (
          <>
            <DropdownMenuLabel className="kicker">Projects</DropdownMenuLabel>
            {others.map((p) => (
              <DropdownMenuItem key={p.id} asChild>
                <Link href={`/projects/${p.id}`}>{p.name}</Link>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem asChild>
          <Link href="/projects">All projects</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/projects">
            <Plus className="size-4" /> New project
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
