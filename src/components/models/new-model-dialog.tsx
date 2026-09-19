"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Project } from "@/lib/types";
import { validateModelName } from "@/lib/validation";
import { useProjectStore } from "@/store/project-store";

interface Props {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewModelDialog({ project, open, onOpenChange }: Props) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const createModel = useProjectStore((s) => s.createModel);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const err = validateModelName(name, project.models);
    setError(err);
    if (err) return;
    setSaving(true);
    try {
      const model = await createModel(project.id, name);
      onOpenChange(false);
      setName("");
      router.push(`/projects/${project.id}/models/${model.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the model.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>New model</DialogTitle>
            <DialogDescription>{'Name the kind of thing you want to store. Use a singular word, like "Customer".'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="model-name">Model name</Label>
            <Input
              id="model-name"
              autoFocus
              value={name}
              placeholder="Customer"
              aria-invalid={!!error}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
            />
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? "Creating…" : "Create model"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
