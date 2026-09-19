"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { PROJECT_NAV, isNavActive, navHref } from "./nav-items";

interface Props {
  projectId: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}

export function AppSidebar({ projectId, collapsed = false, onNavigate }: Props) {
  const pathname = usePathname();
  return (
    <nav aria-label="Project" className="flex flex-col gap-1 p-2">
      {PROJECT_NAV.map(({ segment, label, icon: Icon }) => {
        const active = isNavActive(pathname, projectId, segment);
        return (
          <Link
            key={label}
            href={navHref(projectId, segment)}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            title={collapsed ? label : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground",
              active && "bg-primary/10 text-foreground",
              collapsed && "justify-center px-2",
            )}
          >
            <Icon className={cn("size-4 shrink-0", active && "text-primary")} />
            <span className={cn(collapsed && "sr-only")}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
