import Link from "next/link";
import { countLabel, timeAgo } from "@/lib/format";
import { baseUrl } from "@/lib/slug";
import type { Project } from "@/lib/types";

export function ProjectRow({ project }: { project: Project }) {
  return (
    <Link
      href={`/projects/${project.id}`}
      className="grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-1 px-4 py-3 transition-colors duration-150 hover:bg-panel focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:grid-cols-[1fr_auto_auto_auto]"
    >
      <div className="min-w-0">
        <p className="truncate font-semibold text-ink">{project.name}</p>
        {project.description && <p className="truncate text-[13px] text-ink-3">{project.description}</p>}
      </div>
      <code className="truncate font-mono text-xs text-ink-2">{baseUrl(project.slug)}</code>
      <span className="font-mono text-xs text-ink-3">
        {countLabel(project.models.length, "resource")} · {countLabel(project.routes.length, "endpoint")}
      </span>
      <span className="text-xs text-ink-3">Edited {timeAgo(project.updatedAt)}</span>
    </Link>
  );
}
