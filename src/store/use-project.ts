"use client";

import { useParams } from "next/navigation";
import { useEffect } from "react";
import type { Project } from "@/lib/types";
import { useProjectStore } from "./project-store";

export function useProjects() {
  const projects = useProjectStore((s) => s.projects);
  const loaded = useProjectStore((s) => s.loaded);
  const loadError = useProjectStore((s) => s.loadError);
  const loadProjects = useProjectStore((s) => s.loadProjects);
  useEffect(() => {
    // Deliberately keyed on `loaded` alone, not `loadError`: a failed attempt sets `loadError`
    // without ever setting `loaded`, and re-adding it as a dependency would re-fire this
    // effect the instant `loadProjects` clears it at the start of its next attempt, racing the
    // explicit retry call below. One automatic attempt on mount; after that, only an explicit
    // retry tries again.
    if (!loaded) void loadProjects();
  }, [loaded, loadProjects]);
  return { projects, loaded, loadError, retry: loadProjects };
}

export function useProject(projectId: string) {
  const { projects, loaded } = useProjects();
  return { project: projects.find((p) => p.id === projectId) ?? null, loaded };
}

/** For pages under /projects/[projectId]; the project layout guarantees the project is loaded. */
export function useCurrentProject(): Project {
  const { projectId } = useParams<{ projectId: string }>();
  const project = useProjectStore((s) => s.projects.find((p) => p.id === projectId));
  if (!project) throw new Error("useCurrentProject must be used inside a loaded project layout");
  return project;
}
