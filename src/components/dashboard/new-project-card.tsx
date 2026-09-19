"use client";

import { useState } from "react";
import { SketchCard } from "@/components/domain/sketch-card";
import { UrlSegments } from "@/components/domain/url-segments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CreateProjectInput } from "@/lib/services";
import { slugify } from "@/lib/slug";
import { TEMPLATES } from "@/lib/templates";
import type { Project, TemplateId } from "@/lib/types";
import { cn } from "@/lib/utils";
import { validateProjectName } from "@/lib/validation";

interface Props {
  existingProjects: Project[];
  onCreate: (input: CreateProjectInput) => Promise<void>;
  autoFocus?: boolean;
}

const CHIP = "rounded-full border px-3 py-1 text-xs transition-colors duration-150 hover:bg-soft";

export function NewProjectCard({ existingProjects, onCreate, autoFocus }: Props) {
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState<TemplateId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const err = validateProjectName(name, existingProjects);
    setError(err);
    if (err) return;
    setSubmitting(true);
    try {
      await onCreate({ name: name.trim(), description: "", templateId });
      setName("");
      setTemplateId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the API.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SketchCard className="p-5">
      <form onSubmit={submit} className="flex h-full flex-col gap-3">
        <label htmlFor="new-project-name" className="text-sm font-semibold">
          New API name
        </label>
        <Input
          id="new-project-name"
          autoFocus={autoFocus}
          value={name}
          placeholder="My Store"
          aria-invalid={!!error}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
        />
        <UrlSegments slug={slugify(name) || "your-api"} className="text-xs" />
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Starting point">
          <button
            type="button"
            aria-pressed={templateId === null}
            onClick={() => setTemplateId(null)}
            className={cn(CHIP, templateId === null && "border-primary bg-pastel-blue text-pastel-blue-ink")}
          >
            Blank
          </button>
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={templateId === t.id}
              onClick={() => setTemplateId(t.id)}
              className={cn(CHIP, templateId === t.id && "border-primary bg-pastel-blue text-pastel-blue-ink")}
            >
              <span aria-hidden>{t.emoji} </span>
              {t.name}
            </button>
          ))}
        </div>
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" disabled={submitting} className="mt-auto self-start rounded-xl">
          {submitting ? "Creating…" : "Create"}
        </Button>
      </form>
    </SketchCard>
  );
}
