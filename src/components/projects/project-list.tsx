import type { Project } from "@/lib/types";
import { ProjectRow } from "./project-row";

export function ProjectList({ projects }: { projects: Project[] }) {
  return (
    <div className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
      {projects.map((p) => (
        <ProjectRow key={p.id} project={p} allProjects={projects} />
      ))}
    </div>
  );
}
