"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Kicker } from "@/components/domain/kicker";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ApiPlan } from "@/lib/ai/plan";
import { countLabel } from "@/lib/format";
import type { Project } from "@/lib/types";
import { useProjectStore } from "@/store/project-store";
import { PlanPreview } from "./plan-preview";

interface Props {
  project: Project;
  /** Called with the first generated resource's id once everything is created. */
  onApplied: (modelId: string) => void;
  onCancel: () => void;
}

type Stage = "idle" | "generating" | "preview" | "applying" | "error";

const EXAMPLES = [
  "A bookstore with books, authors and orders",
  "A task tracker with projects, tasks and comments",
  "A fitness app with workouts, exercises and logs",
];

const MAX_DESCRIPTION = 2000;

export function AiGeneratePanel({ project, onApplied, onCancel }: Props) {
  const applyPlan = useProjectStore((s) => s.applyPlan);
  const [description, setDescription] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ plan: ApiPlan; warnings: string[] } | null>(null);
  const busy = stage === "generating" || stage === "applying";
  // The request outlives the panel if it is closed mid-flight: abort it, and never touch
  // state afterwards.
  const abort = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      abort.current?.abort();
    };
  }, []);

  async function generate() {
    if (busy || !description.trim()) return;
    setStage("generating");
    setError(null);
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    try {
      const response = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          description: description.trim(),
          existingResourceNames: project.models.map((m) => m.name),
        }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!mounted.current || controller.signal.aborted) return;
      const data = (payload ?? {}) as { plan?: ApiPlan; warnings?: string[]; error?: string };
      if (!response.ok || !data.plan) {
        setError(data.error ?? "The AI request failed. Try again.");
        setStage("error");
        return;
      }
      setResult({ plan: data.plan, warnings: data.warnings ?? [] });
      setStage("preview");
    } catch (e) {
      // An abort is the panel closing or a newer request starting, not a failure.
      if (!mounted.current || controller.signal.aborted || (e instanceof Error && e.name === "AbortError")) return;
      setError("Could not reach the AI service. Check your connection and try again.");
      setStage("error");
    }
  }

  async function apply() {
    if (busy || !result) return;
    setStage("applying");
    setError(null);
    try {
      const { modelIds, routeCount } = await applyPlan(project.id, result.plan);
      if (!mounted.current) return;
      toast.success(`Generated ${countLabel(modelIds.length, "resource")} and ${countLabel(routeCount, "endpoint")}`);
      onApplied(modelIds[0]);
    } catch (e) {
      if (!mounted.current) return;
      // Anything already created stays; the plan stays on screen so Apply can be retried.
      setError(e instanceof Error ? e.message : "Could not create the resources.");
      setStage("preview");
    }
  }

  const resourceCount = result?.plan.resources.length ?? 0;
  const endpointCount = resourceCount * 5;

  return (
    <section
      aria-label="Generate with AI"
      className="mx-auto max-w-2xl space-y-5 px-8 py-10"
      onKeyDown={(e) => {
        if (e.key === "Escape" && !busy) onCancel();
      }}
    >
      <div>
        <Kicker>Generate with AI</Kicker>
        <h2 className="mt-1 text-xl font-semibold">Describe the API you need</h2>
        <p className="mt-1 text-sm text-ink-2">
          Say what your app stores. You get resources, fields, the standard endpoints and sample records to review before
          anything is created.
        </p>
      </div>

      <div className="space-y-2">
        <Textarea
          aria-label="Describe the API you need"
          autoFocus
          rows={4}
          maxLength={MAX_DESCRIPTION}
          value={description}
          disabled={busy}
          placeholder="A bookstore with books, authors and orders"
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void generate();
            }
          }}
        />
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              disabled={busy}
              className="rounded-full border border-line px-2.5 py-1 text-xs text-ink-2 hover:bg-panel-strong disabled:opacity-50"
              onClick={() => setDescription(example)}
            >
              {example}
            </button>
          ))}
        </div>
        <p className="text-xs text-ink-3">⌘/Ctrl + Enter to generate, Esc to cancel.</p>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-danger/40 bg-danger/5 p-3">
          <p className="text-sm text-danger">{error}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2 rounded-md"
            disabled={busy}
            onClick={() => void (result ? apply() : generate())}
          >
            Retry
          </Button>
        </div>
      )}

      {stage !== "preview" && stage !== "applying" && (
        <div className="flex gap-2">
          <Button disabled={busy || !description.trim()} onClick={() => void generate()}>
            {stage === "generating" ? (
              <>
                <Loader2 aria-hidden className="size-4 animate-spin" />
                Asking Luna…
              </>
            ) : (
              <>
                <Sparkles aria-hidden className="size-4" />
                Generate
              </>
            )}
          </Button>
          <Button type="button" variant="ghost" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
        </div>
      )}

      {result && (stage === "preview" || stage === "applying") && (
        <>
          <PlanPreview plan={result.plan} warnings={result.warnings} />
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => void apply()}>
              {stage === "applying"
                ? "Creating…"
                : `Create ${countLabel(resourceCount, "resource")}, ${countLabel(endpointCount, "endpoint")}`}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                setResult(null);
                setStage("idle");
                void generate();
              }}
            >
              Regenerate
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setResult(null);
                setStage("idle");
              }}
            >
              Discard
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
