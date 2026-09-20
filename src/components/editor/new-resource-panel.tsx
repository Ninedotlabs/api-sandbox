"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Kicker } from "@/components/domain/kicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resourcePath } from "@/lib/slug";
import type { Model, Project } from "@/lib/types";
import { validateModelName } from "@/lib/validation";
import { useProjectStore } from "@/store/project-store";

interface Props {
  project: Project;
  onCreated: (model: Model) => void;
  onCancel: () => void;
}

/** The centre-pane form for naming a new resource. Shown by "Add a resource" and the rail's "+ Resource". */
export function NewResourcePanel({ project, onCreated, onCancel }: Props) {
  const createModel = useProjectStore((s) => s.createModel);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const preview = name.trim() ? resourcePath(name.trim()) : "/…";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    const invalid = validateModelName(name, project.models);
    setError(invalid);
    if (invalid) return;
    setPending(true);
    try {
      const model = await createModel(project.id, name.trim());
      toast.success(`${model.name} created. Now give it a schema.`);
      onCreated(model);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the resource.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-xl space-y-5 px-8 py-10" onKeyDown={(e) => e.key === "Escape" && onCancel()}>
      <div>
        <Kicker>New resource</Kicker>
        <h2 className="mt-1 text-xl font-semibold">What does your API store?</h2>
        <p className="mt-1 text-sm text-ink-2">
          A resource is one kind of record, like a Product or a Customer. Its endpoints are created under{" "}
          <code className="font-mono text-ink">{preview}</code>.
        </p>
      </div>
      <div className="space-y-2">
        <label htmlFor="new-resource-name" className="text-sm font-medium">
          Resource name
        </label>
        <Input
          id="new-resource-name"
          autoFocus
          value={name}
          placeholder="Product"
          aria-invalid={!!error}
          disabled={pending}
          className="h-10 text-base"
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
        />
        <p className="text-xs text-ink-3">Singular, starting with a letter. Enter to create, Esc to cancel.</p>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create resource"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
