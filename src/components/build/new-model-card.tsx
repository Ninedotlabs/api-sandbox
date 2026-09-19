"use client";

import { useState } from "react";
import { SketchCard } from "@/components/domain/sketch-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Model, Project } from "@/lib/types";
import { validateModelName } from "@/lib/validation";
import { useProjectStore } from "@/store/project-store";

interface Props {
  project: Project;
  onCreated: (model: Model) => void;
  onCancel: () => void;
}

export function NewModelCard({ project, onCreated, onCancel }: Props) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const createModel = useProjectStore((s) => s.createModel);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const err = validateModelName(name, project.models);
    setError(err);
    if (err) return;
    setSaving(true);
    try {
      onCreated(await createModel(project.id, name.trim()));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the model.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SketchCard className="p-4">
      <form onSubmit={submit} className="flex flex-wrap items-center gap-3" onKeyDown={(e) => e.key === "Escape" && onCancel()}>
        <Input
          autoFocus
          aria-label="New model name"
          value={name}
          placeholder="Customer"
          className="w-56"
          aria-invalid={!!error}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
        />
        <span className="text-xs text-ink-muted">Singular, like Customer. Enter to create, Esc to cancel.</span>
        <Button type="submit" size="sm" className="rounded-xl" disabled={saving}>
          {saving ? "Creating…" : "Create model"}
        </Button>
        <Button type="button" size="sm" variant="ghost" className="rounded-xl" onClick={onCancel}>
          Cancel
        </Button>
        {error && (
          <p role="alert" className="w-full text-xs text-destructive">
            {error}
          </p>
        )}
      </form>
    </SketchCard>
  );
}
