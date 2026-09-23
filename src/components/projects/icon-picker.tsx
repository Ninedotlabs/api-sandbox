"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PROJECT_ICONS, type ProjectIconDefinition, resolveProjectIcon } from "@/lib/project-icons";
import type { Project } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useProjectStore } from "@/store/project-store";
import { ProjectIcon } from "./project-icon";

/**
 * Choose a project's icon.
 *
 * A project always shows *something* — an icon derived from its slug — so this dialog is
 * about replacing a reasonable default, never filling a hole. "Use the automatic one" puts
 * the project back on that default by clearing the stored choice, which is why the reset is
 * a first-class option rather than a hidden one.
 */

const GROUP_ORDER: ProjectIconDefinition["group"][] = ["General", "Commerce", "Media", "People", "Systems"];

interface Props {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function IconPicker({ project, open, onOpenChange }: Props) {
  const updateProject = useProjectStore((s) => s.updateProject);
  const [saving, setSaving] = useState(false);
  const current = resolveProjectIcon(project);
  const automatic = !project.icon;

  async function choose(icon: string | null) {
    setSaving(true);
    try {
      await updateProject(project.id, { icon });
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not change this icon.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Icon for {project.name}</DialogTitle>
          <DialogDescription>
            Pick one, or keep the automatic icon — chosen from the project&apos;s address, so it never changes on its own.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {GROUP_ORDER.map((group) => (
            <section key={group} className="space-y-2">
              <p className="kicker">{group}</p>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-2">
                {PROJECT_ICONS.filter((icon) => icon.group === group).map((icon) => {
                  const selected = !automatic && icon.id === current.id;
                  return (
                    <button
                      key={icon.id}
                      type="button"
                      disabled={saving}
                      aria-pressed={selected}
                      title={icon.label}
                      onClick={() => void choose(icon.id)}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-lg border p-2 transition-colors",
                        "hover:border-line-strong hover:bg-panel focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                        selected ? "border-accent bg-accent-soft" : "border-line",
                      )}
                    >
                      <ProjectIcon definition={icon} className="size-9" />
                      <span className="w-full truncate text-center text-[11px] text-ink-3">{icon.label}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
          <p className="text-xs text-ink-3">
            {automatic ? "Using the automatic icon." : `Using ${current.label}.`}
          </p>
          <Button variant="outline" size="sm" disabled={saving || automatic} onClick={() => void choose(null)}>
            Use the automatic one
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
