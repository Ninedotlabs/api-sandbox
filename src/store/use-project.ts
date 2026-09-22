"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import type { Project } from "@/lib/types";
import { useProjectStore } from "./project-store";

export function useProjects() {
  const allProjects = useProjectStore((s) => s.projects);
  const foreignIds = useProjectStore((s) => s.foreignIds);
  // Filtered here rather than in the selector: a selector returning a fresh array every call
  // would make zustand re-render forever.
  const projects = useMemo(
    () => (foreignIds.length ? allProjects.filter((p) => !foreignIds.includes(p.id)) : allProjects),
    [allProjects, foreignIds],
  );
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

/**
 * A project from the account's own list or, failing that, fetched by id - how an admin opens
 * another account's project from `/admin`. For anyone else the server answers 404 and this
 * resolves to `null` exactly as before.
 */
export function useProject(projectId: string) {
  const { loaded } = useProjects();
  const project = useProjectStore((s) => s.projects.find((p) => p.id === projectId)) ?? null;
  const lookup = useProjectStore((s) => s.lookups[projectId]);
  const loadProjectById = useProjectStore((s) => s.loadProjectById);

  const needsLookup = loaded && !project && lookup === undefined;
  useEffect(() => {
    if (needsLookup) void loadProjectById(projectId);
  }, [needsLookup, projectId, loadProjectById]);

  return { project, loaded: loaded && (project !== null || lookup === "done") };
}

/** For pages under /projects/[projectId]; the project layout guarantees the project is loaded. */
export function useCurrentProject(): Project {
  const { projectId } = useParams<{ projectId: string }>();
  const project = useProjectStore((s) => s.projects.find((p) => p.id === projectId));
  if (!project) throw new Error("useCurrentProject must be used inside a loaded project layout");
  return project;
}
