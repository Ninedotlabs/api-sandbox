"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ContextMenuTarget } from "@/components/domain/context-menu-target";
import { copyToClipboard } from "@/components/domain/copy-to-clipboard";
import { InlineEdit } from "@/components/domain/inline-edit";
import { projectItems } from "@/lib/context-menu-items";
import { countLabel, timeAgo } from "@/lib/format";
import { baseUrl } from "@/lib/slug";
import type { Project } from "@/lib/types";
import { validateProjectName } from "@/lib/validation";
import { useProjectStore } from "@/store/project-store";

interface Props {
  project: Project;
  /** Every project, so Rename can reject a name already used by another one. */
  allProjects: Project[];
}

/** A click anywhere on the row except an inline-edit control opens the project. */
function isEditControl(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && !!target.closest("input, button");
}

export function ProjectRow({ project, allProjects }: Props) {
  const router = useRouter();
  const updateProject = useProjectStore((s) => s.updateProject);
  const duplicateProject = useProjectStore((s) => s.duplicateProject);
  const deleteProject = useProjectStore((s) => s.deleteProject);
  const restoreProject = useProjectStore((s) => s.restoreProject);
  const [renaming, setRenaming] = useState(false);

  const open = () => router.push(`/projects/${project.id}`);

  async function rename(name: string) {
    try {
      await updateProject(project.id, { name });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not rename this API.";
      toast.error(message);
      throw new Error(message);
    }
  }

  async function duplicate() {
    try {
      const copy = await duplicateProject(project.id);
      router.push(`/projects/${copy.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not duplicate this API.");
    }
  }

  async function remove() {
    try {
      const removed = await deleteProject(project.id);
      toast(`${project.name} deleted`, {
        action: {
          label: "Undo",
          onClick: () =>
            void restoreProject(removed).catch((e) => toast.error(e instanceof Error ? e.message : "Could not undo.")),
        },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete this API.");
    }
  }

  const items = projectItems(project, {
    onOpen: open,
    onOpenInNewTab: () => window.open(`/projects/${project.id}`, "_blank", "noopener"),
    onOpenReference: () => router.push(`/projects/${project.id}/reference`),
    onCopyBaseUrl: (url) => void copyToClipboard(url, "Base URL copied"),
    // Deferred a tick: closing the context menu returns focus to this row, which — the same
    // tick the rename input mounts and grabs it — would immediately blur it again; InlineEdit
    // treats an unchanged blur as "done" and would cancel the rename before the user typed
    // anything. Waiting for that focus-return to land first avoids the race (the same fix Radix
    // itself recommends for opening a dialog from a menu item's onSelect).
    onRename: () => setTimeout(() => setRenaming(true), 0),
    onDuplicate: () => void duplicate(),
    onDelete: () => void remove(),
  });

  return (
    <ContextMenuTarget items={items} asChild>
      <div
        role="link"
        tabIndex={0}
        onClick={(e) => {
          if (!isEditControl(e.target)) open();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !isEditControl(e.target)) open();
        }}
        className="grid cursor-pointer grid-cols-[1fr_auto] items-center gap-x-6 gap-y-1 px-4 py-3 transition-colors duration-150 hover:bg-panel focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:grid-cols-[1fr_auto_auto_auto]"
      >
        <div className="min-w-0">
          <InlineEdit
            value={project.name}
            ariaLabel="Project name"
            editing={renaming}
            onEditingChange={setRenaming}
            validate={(name) => validateProjectName(name, allProjects, project.id)}
            onSave={rename}
            className="font-semibold text-ink"
          />
          {project.description && <p className="truncate text-[13px] text-ink-3">{project.description}</p>}
        </div>
        <code className="truncate font-mono text-xs text-ink-2">{baseUrl(project.slug)}</code>
        <span className="font-mono text-xs text-ink-3">
          {countLabel(project.models.length, "resource")} · {countLabel(project.routes.length, "endpoint")}
        </span>
        <span className="text-xs text-ink-3">Edited {timeAgo(project.updatedAt)}</span>
      </div>
    </ContextMenuTarget>
  );
}
