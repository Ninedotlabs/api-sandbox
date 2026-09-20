"use client";

import { MoreVertical, RotateCcw, Settings, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { consoleService } from "@/lib/services";
import type { Project } from "@/lib/types";
import { useProjectStore } from "@/store/project-store";

export function ProjectMenu({ project }: { project: Project }) {
  const [armed, setArmed] = useState(false);
  const deleteProject = useProjectStore((s) => s.deleteProject);
  const restoreProject = useProjectStore((s) => s.restoreProject);
  const router = useRouter();

  async function resetData() {
    try {
      await consoleService.reset(project.id);
      toast("Sample data reset");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reset the sample data.");
    }
  }

  async function remove() {
    setArmed(false);
    try {
      const snapshot = await deleteProject(project.id);
      router.push("/projects");
      toast(`${snapshot.name} deleted`, {
        action: {
          label: "Undo",
          onClick: () =>
            void restoreProject(snapshot).catch((e) => toast.error(e instanceof Error ? e.message : "Could not undo.")),
        },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete the API.");
    }
  }

  return (
    <DropdownMenu onOpenChange={(open) => !open && setArmed(false)}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Project actions" className="rounded-md text-ink-2">
          <MoreVertical className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 rounded-xl">
        <DropdownMenuItem asChild>
          <Link href={`/projects/${project.id}/settings`}>
            <Settings className="size-4" /> Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={resetData}>
          <RotateCcw className="size-4" /> Reset sample data
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={(e) => {
            if (!armed) {
              e.preventDefault();
              setArmed(true);
              return;
            }
            void remove();
          }}
        >
          <Trash2 className="size-4" /> {armed ? "Sure? Delete" : "Delete project"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
