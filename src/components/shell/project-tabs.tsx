"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { PROJECT_NAV, isNavActive, navHref } from "./nav-items";

export function ProjectTabs({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Project sections" className="flex flex-wrap gap-1">
      {PROJECT_NAV.map(({ segment, label, icon: Icon }) => {
        const active = isNavActive(pathname, projectId, segment);
        return (
          <Link
            key={label}
            href={navHref(projectId, segment)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm text-ink-muted transition-colors duration-150 hover:bg-soft hover:text-ink",
              active && "bg-soft font-semibold text-ink",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
