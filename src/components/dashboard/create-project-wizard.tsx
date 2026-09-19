"use client";

import { useState } from "react";
import { TemplateCard } from "@/components/domain/template-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import type { CreateProjectInput } from "@/lib/services";
import { baseUrl, slugify } from "@/lib/slug";
import { TEMPLATES, templateModelNames } from "@/lib/templates";
import type { Project, TemplateId } from "@/lib/types";
import { validateProjectName } from "@/lib/validation";

const STEPS = ["Name your API", "Choose a starting point", "Review"];

interface Props {
  existingProjects: Project[];
  initialTemplate: TemplateId | null;
  onCreate: (input: CreateProjectInput) => Promise<void>;
}

export function CreateProjectWizard({ existingProjects, initialTemplate, onCreate }: Props) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [templateId, setTemplateId] = useState<TemplateId | null>(initialTemplate);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const template = TEMPLATES.find((t) => t.id === templateId);

  function next() {
    if (step === 0) {
      const err = validateProjectName(name, existingProjects);
      setError(err);
      if (err) return;
    }
    setStep((s) => s + 1);
  }

  async function create() {
    setSubmitting(true);
    try {
      await onCreate({ name, description, templateId });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <p className="text-sm text-muted-foreground">Step {step + 1} of 3</p>
        <CardTitle className="text-2xl">{STEPS[step]}</CardTitle>
        <Progress value={((step + 1) / 3) * 100} aria-label="Wizard progress" className="mt-2" />
      </CardHeader>
      <CardContent className="space-y-6">
        {step === 0 && (
          <>
            <div className="space-y-2">
              <Label htmlFor="api-name">API name</Label>
              <Input
                id="api-name"
                autoFocus
                value={name}
                placeholder="My Store"
                aria-invalid={!!error}
                aria-describedby="api-name-help"
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
              />
              <p id="api-name-help" className="text-sm text-muted-foreground">
                Your API will live at <code className="font-mono text-foreground">{baseUrl(slugify(name) || "your-api")}</code>
              </p>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="api-description">
                Description <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="api-description"
                value={description}
                maxLength={200}
                placeholder="What is this API for?"
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </>
        )}

        {step === 1 && (
          <div className="grid gap-3 sm:grid-cols-2">
            <TemplateCard
              emoji="⬜"
              name="Start blank"
              description="Add your own models from scratch"
              selected={templateId === null}
              onSelect={() => setTemplateId(null)}
            />
            {TEMPLATES.map((t) => (
              <TemplateCard
                key={t.id}
                emoji={t.emoji}
                name={t.name}
                description={t.description}
                selected={templateId === t.id}
                onSelect={() => setTemplateId(t.id)}
              />
            ))}
          </div>
        )}

        {step === 2 && (
          <dl className="grid gap-4 rounded-[10px] border bg-surface p-4 text-sm sm:grid-cols-[160px_1fr]">
            <dt className="text-muted-foreground">Name</dt>
            <dd className="font-medium">{name.trim()}</dd>
            <dt className="text-muted-foreground">Address</dt>
            <dd>
              <code className="font-mono">{baseUrl(slugify(name))}</code>
            </dd>
            <dt className="text-muted-foreground">Starting point</dt>
            <dd>{template ? `${template.emoji} ${template.name}` : "Blank"}</dd>
            <dt className="text-muted-foreground">Models</dt>
            <dd>{template ? templateModelNames(template.id).join(", ") : "None yet. You'll add them next."}</dd>
          </dl>
        )}

        {step === 2 && error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex justify-between gap-2">
          <Button variant="outline" onClick={() => setStep((s) => s - 1)} disabled={step === 0 || submitting}>
            Back
          </Button>
          {step < 2 ? (
            <Button onClick={next}>Next</Button>
          ) : (
            <Button onClick={create} disabled={submitting}>
              {submitting ? "Creating…" : "Create API"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
