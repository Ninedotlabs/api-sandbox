"use client";

import { useState } from "react";
import { MethodBadge } from "@/components/domain/method-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { buildCrudRoutes, crudOptions, type CrudAction, type CrudOption } from "@/lib/crud";
import { countLabel } from "@/lib/format";
import { baseUrl, pluralize } from "@/lib/slug";
import type { Model, Project, Route } from "@/lib/types";

interface Props {
  project: Project;
  model: Model;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (routes: Route[]) => Promise<void> | void;
}

export function CrudGeneratorDialog({ project, model, open, onOpenChange, onGenerate }: Props) {
  const options = crudOptions(model);
  const exists = (o: CrudOption) => project.routes.some((r) => r.method === o.method && r.path === o.path);
  const [selected, setSelected] = useState<CrudAction[]>(() => options.filter((o) => !exists(o)).map((o) => o.action));
  const [saving, setSaving] = useState(false);

  const toggle = (action: CrudAction, on: boolean) =>
    setSelected((s) => (on ? [...s, action] : s.filter((a) => a !== action)));

  async function generate() {
    setSaving(true);
    try {
      await onGenerate(buildCrudRoutes(model, selected, project.routes));
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create endpoints for {model.name}</DialogTitle>
          <DialogDescription>
            Pick the actions people can take on {pluralize(model.name)}. You can change or delete them later.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-2">
          {options.map((o) => {
            const already = exists(o);
            const id = `crud-${o.action}`;
            return (
              <li key={o.action} className="flex items-start gap-3 rounded-md border p-3">
                <Checkbox
                  id={id}
                  className="mt-0.5"
                  checked={already || selected.includes(o.action)}
                  disabled={already}
                  onCheckedChange={(v) => toggle(o.action, v === true)}
                />
                <label htmlFor={id} className="flex-1 space-y-1">
                  <span className="flex items-center justify-between gap-2 text-sm font-medium">
                    {o.label}
                    {already ? (
                      <span className="text-xs text-muted-foreground">Already exists</span>
                    ) : (
                      <MethodBadge method={o.method} tooltip={false} />
                    )}
                  </span>
                  <code className="block font-mono text-xs text-muted-foreground">
                    {baseUrl(project.slug)}
                    {o.path}
                  </code>
                </label>
              </li>
            );
          })}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={generate} disabled={selected.length === 0 || saving}>
            Create {countLabel(selected.length, "endpoint")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
