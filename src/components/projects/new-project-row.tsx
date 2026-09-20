"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CreateProjectInput } from "@/lib/services";
import { baseUrl, slugify } from "@/lib/slug";
import { TEMPLATES } from "@/lib/templates";
import type { Project, TemplateId } from "@/lib/types";
import { validateProjectName } from "@/lib/validation";

interface Props {
  existingProjects: Project[];
  onCreate: (input: CreateProjectInput) => Promise<void>;
  autoFocus?: boolean;
}

const CHOICES: { id: TemplateId | null; label: string }[] = [
  { id: null, label: "Blank" },
  ...TEMPLATES.map((t) => ({ id: t.id as TemplateId | null, label: t.name })),
];

export function NewProjectRow({ existingProjects, onCreate, autoFocus }: Props) {
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState<TemplateId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const radios = useRef<(HTMLButtonElement | null)[]>([]);

  /** Arrow keys move the checked radio (and focus with it), as a radiogroup should. */
  function moveTemplate(e: React.KeyboardEvent) {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const current = CHOICES.findIndex((c) => c.id === templateId);
    const next = (current + step + CHOICES.length) % CHOICES.length;
    setTemplateId(CHOICES[next].id);
    radios.current[next]?.focus();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const invalid = validateProjectName(name, existingProjects);
    setError(invalid);
    if (invalid) return;
    setSubmitting(true);
    try {
      await onCreate({ name: name.trim(), description: "", templateId });
      setName("");
      setTemplateId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the project.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-3 p-3">
      <div className="min-w-56 flex-1">
        <label htmlFor="new-project-name" className="sr-only">
          Project name
        </label>
        <Input
          id="new-project-name"
          autoFocus={autoFocus}
          value={name}
          placeholder="New project name"
          aria-invalid={!!error}
          className="h-9 rounded-md bg-surface"
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
        />
      </div>
      <code className="hidden font-mono text-xs text-ink-3 sm:block">{baseUrl(slugify(name) || "your-api")}</code>
      <div
        role="radiogroup"
        aria-label="Template"
        className="flex items-center gap-px overflow-hidden rounded-md border border-line bg-panel"
        onKeyDown={moveTemplate}
      >
        {CHOICES.map((choice, index) => {
          const selected = templateId === choice.id;
          return (
            <button
              key={choice.label}
              type="button"
              role="radio"
              aria-checked={selected}
              // Roving tabindex: Tab reaches the group once, arrows move within it.
              tabIndex={selected ? 0 : -1}
              ref={(node) => {
                radios.current[index] = node;
              }}
              onClick={() => setTemplateId(choice.id)}
              className={
                selected
                  ? "bg-accent-soft px-3 py-1.5 text-xs font-medium text-accent-ink"
                  : "px-3 py-1.5 text-xs text-ink-2 transition-colors duration-150 hover:bg-panel-strong"
              }
            >
              {choice.label}
            </button>
          );
        })}
      </div>
      <Button type="submit" size="sm" disabled={submitting} className="rounded-md">
        {submitting ? "Creating…" : "Create"}
      </Button>
      {error && (
        <p role="alert" className="w-full text-xs text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
