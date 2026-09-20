"use client";

import { ListTree, Search, SquareTerminal } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "@/components/brand/wordmark";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { Button } from "@/components/ui/button";
import type { Project } from "@/lib/types";
import { useUiStore } from "@/store/ui-store";
import { ProjectMenu } from "./project-menu";
import { ProjectSwitcher } from "./project-switcher";
import { UserAvatar } from "./user-avatar";

/** The drawer toggles live in the workspace context, so they only exist inside a project. */
function DrawerToggles() {
  const { railOpen, setRailOpen, consoleOpen, setConsoleOpen } = useWorkspace();
  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Tree"
        className="rounded-md text-ink-2 md:hidden"
        onClick={() => setRailOpen(!railOpen)}
      >
        <ListTree className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 rounded-md px-2 text-ink-2 min-[1100px]:hidden"
        onClick={() => setConsoleOpen(!consoleOpen)}
      >
        <SquareTerminal className="size-4" />
        Console
      </Button>
    </>
  );
}

export function TopBar({ project }: { project?: Project }) {
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);
  const pathname = usePathname();
  // The rail and console only exist on the workspace route, so the toggles would be dead elsewhere.
  const onWorkspace = !!project && pathname === `/projects/${project.id}`;

  return (
    <header className="flex h-12 items-center gap-2 border-b border-line bg-rail px-3">
      <Wordmark />
      {project && (
        <>
          <span aria-hidden className="text-ink-3">
            /
          </span>
          <ProjectSwitcher project={project} />
        </>
      )}
      <div className="ml-auto flex items-center gap-1">
        {project && (
          <>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Search"
              className="gap-2 rounded-md px-2 text-ink-2"
              onClick={() => setCommandOpen(true)}
            >
              <Search className="size-4" />
              <kbd className="hidden font-mono text-[11px] text-ink-3 sm:inline">⌘K</kbd>
            </Button>
            <Link
              href={`/projects/${project.id}/reference`}
              className="rounded-md px-2 py-1 text-sm text-ink-2 transition-colors duration-150 hover:bg-panel hover:text-ink"
            >
              Reference
            </Link>
            {onWorkspace && <DrawerToggles />}
            <ProjectMenu project={project} />
          </>
        )}
        <UserAvatar />
      </div>
    </header>
  );
}
