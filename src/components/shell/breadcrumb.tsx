import Link from "next/link";
import type { Project } from "@/lib/types";
import { ProjectMenu } from "./project-menu";

export function Breadcrumb({ project }: { project: Project }) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <Link href="/projects" className="text-primary hover:underline">
        Projects
      </Link>
      <span className="text-ink-3">/</span>
      <span className="flex size-8 items-center justify-center rounded-lg bg-accent-soft font-semibold text-accent-ink">
        {project.name.charAt(0).toUpperCase()}
      </span>
      <h1 className="truncate text-base font-semibold">{project.name}</h1>
      <ProjectMenu project={project} />
    </div>
  );
}
