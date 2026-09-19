"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import type { Model, Project } from "@/lib/types";
import { validateModelName } from "@/lib/validation";
import { useProjectStore } from "@/store/project-store";

interface Props {
  project: Project;
  onCreated: (model: Model) => void;
  onCancel: () => void;
}

/** The inline row the rail shows under the tree while a resource is being named. */
export function NewResourceRow({ project, onCreated, onCancel }: Props) {
  const createModel = useProjectStore((s) => s.createModel);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    if (pending) return;
    const invalid = validateModelName(name, project.models);
    setError(invalid);
    if (invalid) return;
    setPending(true);
    try {
      onCreated(await createModel(project.id, name.trim()));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the resource.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="px-2 py-1">
      <Input
        autoFocus
        aria-label="Resource name"
        aria-invalid={!!error}
        value={name}
        placeholder="Resource name"
        disabled={pending}
        className="h-7 rounded-md bg-surface text-[13px]"
        onChange={(e) => {
          setName(e.target.value);
          setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void submit();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
      />
      {error && (
        <p role="alert" className="px-1 pt-1 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
