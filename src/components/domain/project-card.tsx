import Link from "next/link";
import { countLabel, timeAgo } from "@/lib/format";
import { baseUrl } from "@/lib/slug";
import type { Project } from "@/lib/types";

export function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      href={`/projects/${project.id}`}
      className="flex flex-col rounded-2xl border bg-surface p-5 transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-ring"
    >
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft font-semibold text-accent-ink">
          {project.name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <h3 className="truncate font-semibold">{project.name}</h3>
          <code className="block truncate font-mono text-xs text-muted-foreground">{baseUrl(project.slug)}</code>
        </div>
      </div>
      {project.description && <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{project.description}</p>}
      <div className="mt-auto flex items-center justify-between gap-2 pt-4 text-xs text-muted-foreground">
        <span>
          {countLabel(project.models.length, "model")} · {countLabel(project.routes.length, "route")}
        </span>
        <span>Edited {timeAgo(project.updatedAt)}</span>
      </div>
    </Link>
  );
}
