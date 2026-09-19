"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { HelpHint } from "@/components/domain/help-hint";
import { Button } from "@/components/ui/button";
import { countLabel } from "@/lib/format";
import type { Project } from "@/lib/types";
import { cn } from "@/lib/utils";
import { NewModelDialog } from "./new-model-dialog";

export function ModelList({ project }: { project: Project }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <aside className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          Models
          <HelpHint term="a model">
            A model is like a spreadsheet tab: it describes one kind of thing your API stores, such as Customers or Orders.
          </HelpHint>
        </h2>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Plus className="size-4" /> New
        </Button>
      </div>
      <nav aria-label="Models" className="flex flex-col gap-1">
        {project.models.map((m) => {
          const href = `/projects/${project.id}/models/${m.id}`;
          const active = pathname === href;
          return (
            <Link
              key={m.id}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm transition-colors duration-150 hover:bg-accent",
                active && "bg-primary/10 font-medium",
              )}
            >
              <span className="truncate">{m.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{countLabel(m.fields.length, "field")}</span>
            </Link>
          );
        })}
        {project.models.length === 0 && <p className="px-3 text-sm text-muted-foreground">No models yet.</p>}
      </nav>
      <NewModelDialog project={project} open={open} onOpenChange={setOpen} />
    </aside>
  );
}
