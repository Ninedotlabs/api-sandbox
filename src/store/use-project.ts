"use client";

import { useParams } from "next/navigation";
import { useEffect } from "react";
import type { Project } from "@/lib/types";
import { useProjectStore } from "./project-store";

export function useProjects() {
  const projects = useProjectStore((s) => s.projects);
  const loaded = useProjectStore((s) => s.loaded);
  const loadProjects = useProjectStore((s) => s.loadProjects);
  useEffect(() => {
    if (!loaded) void loadProjects();
  }, [loaded, loadProjects]);
  return { projects, loaded };
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
