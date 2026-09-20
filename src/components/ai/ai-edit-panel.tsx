"use client";

import { Loader2, Wand2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Kicker } from "@/components/domain/kicker";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { computeEditDiff, type EditDiff } from "@/lib/ai/diff";
import type { EditPlan, ExistingResourceSummary } from "@/lib/ai/plan";
import { countLabel } from "@/lib/format";
import { consoleService } from "@/lib/services";
import type { Project } from "@/lib/types";
import { useProjectStore } from "@/store/project-store";
import { EditPlanPreview } from "./edit-plan-preview";

interface Props {
  project: Project;
  onApplied: (modelId: string | null) => void;
  onCancel: () => void;
}

type Stage = "idle" | "generating" | "preview" | "applying" | "error";

const EXAMPLES = [
  "Add a Reviews resource with rating and comment, linked to Book",
  "Add a discount field to Product",
  "Add more variety to Author's sample data",
];

const MAX_INSTRUCTION = 2000;
// A field the model can use to point a new link at a real record, capped so the request
// body stays small even for a resource with a lot of sample data.
const MAX_RECORD_IDS = 20;

export function AiEditPanel({ project, onApplied, onCancel }: Props) {
  const applyEditPlan = useProjectStore((s) => s.applyEditPlan);
  const restoreRecords = useProjectStore((s) => s.restoreRecords);
  const [instruction, setInstruction] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ plan: EditPlan; warnings: string[] } | null>(null);
  const busy = stage === "generating" || stage === "applying";
  const abort = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  // Fetched once, lazily, and reused: real record ids are what let the server validate a
  // new link ("add Reviews linked to Book") against ids that actually exist, instead of
  // nulling it out or pointing it at the wrong record. Loaded on mount so it's usually
  // ready by the time the user submits, but never blocks typing.
  const recordIds = useRef<Promise<Map<string, string[]>> | null>(null);

  function loadRecordIds(): Promise<Map<string, string[]>> {
    if (!recordIds.current) {
      recordIds.current = Promise.all(
        project.models.map(async (model) => {
          const records = await consoleService.sampleData(project.id, model.id);
          const ids = records.slice(0, MAX_RECORD_IDS).map((r) => String((r as { id?: unknown }).id));
          return [model.name, ids] as const;
        }),
      ).then((pairs) => new Map(pairs));
    }
    return recordIds.current;
  }

  useEffect(() => {
    mounted.current = true;
    void loadRecordIds();
    return () => {
      mounted.current = false;
      abort.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generate() {
    if (busy || !instruction.trim()) return;
    setStage("generating");
    setError(null);
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    try {
      const idsByName = await loadRecordIds();
      if (!mounted.current || controller.signal.aborted) return;
      const existing: ExistingResourceSummary[] = project.models.map((m) => {
        const ids = idsByName.get(m.name);
        return {
          name: m.name,
          fields: m.fields.map((f) => ({
            name: f.name,
            type: f.type,
            required: f.required,
            unique: f.unique,
            ...(f.options ? { options: f.options } : {}),
            ...(f.linkTo ? { linkTo: project.models.find((x) => x.id === f.linkTo)?.name } : {}),
          })),
          ...(ids && ids.length > 0 ? { recordIds: ids } : {}),
        };
      });
      const response = await fetch("/api/ai/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ instruction: instruction.trim(), existing }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!mounted.current || controller.signal.aborted) return;
      const data = (payload ?? {}) as { plan?: EditPlan; warnings?: string[]; error?: string };
      if (!response.ok || !data.plan) {
        setError(data.error ?? "The AI request failed. Try again.");
        setStage("error");
        return;
      }
      setResult({ plan: data.plan, warnings: data.warnings ?? [] });
      setStage("preview");
    } catch (e) {
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
      const { modelIds, newResourceCount, changedResourceCount, endpointCount, replacedRecords } = await applyEditPlan(
        project.id,
        result.plan,
      );
      if (!mounted.current) return;
      const summary = `Updated ${countLabel(newResourceCount + changedResourceCount, "resource")}, ${countLabel(endpointCount, "new endpoint")}`;
      if (replacedRecords.length > 0) {
        // Replacing an existing resource's sample records is destructive, so give the
        // user a way back — matching the Undo pattern used for deletes elsewhere.
        toast.success(summary, {
          action: {
            label: "Undo",
            onClick: () =>
              void restoreRecords(project.id, replacedRecords).catch((e) =>
                toast.error(e instanceof Error ? e.message : "Could not undo."),
              ),
          },
        });
      } else {
        toast.success(summary);
      }
      onApplied(modelIds[0] ?? null);
    } catch (e) {
      if (!mounted.current) return;
      // Anything already created stays; the plan stays on screen so Apply can be retried.
      setError(e instanceof Error ? e.message : "Could not apply the changes.");
      setStage("preview");
    }
  }

  const diff: EditDiff | null = result ? computeEditDiff(project, result.plan) : null;
  const newCount = diff?.newResources.length ?? 0;
  const endpointCount = diff?.newEndpoints.length ?? 0;
  const nothingToApply = diff ? diff.newResources.length === 0 && diff.changedResources.length === 0 && diff.newEndpoints.length === 0 : true;
  const applyLabel =
    diff && (newCount > 0 || endpointCount > 0)
      ? `Create ${countLabel(newCount, "resource")} and ${countLabel(endpointCount, "endpoint")}`
      : "Update the API";

  return (
    <section
      aria-label="Edit with AI"
      className="mx-auto max-w-2xl space-y-5 px-8 py-10"
      onKeyDown={(e) => {
        if (e.key === "Escape" && !busy) onCancel();
      }}
    >
      <div>
        <Kicker>Edit with AI</Kicker>
        <h2 className="mt-1 text-xl font-semibold">What should change?</h2>
        <p className="mt-1 text-sm text-ink-2">
          Describe an addition or a change. You get a preview of every new or changed resource, field and endpoint before
          anything is applied — nothing existing is ever removed.
        </p>
      </div>

      <div className="space-y-2">
        <Textarea
          aria-label="Describe what should change"
          autoFocus
          rows={4}
          maxLength={MAX_INSTRUCTION}
          value={instruction}
          disabled={busy}
          placeholder="Add a Reviews resource with rating and comment, linked to Book"
          onChange={(e) => setInstruction(e.target.value)}
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
              onClick={() => setInstruction(example)}
            >
              {example}
            </button>
          ))}
        </div>
        <p className="text-xs text-ink-3">⌘/Ctrl + Enter to preview, Esc to cancel.</p>
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
          <Button disabled={busy || !instruction.trim()} onClick={() => void generate()}>
            {stage === "generating" ? (
              <>
                <Loader2 aria-hidden className="size-4 animate-spin" />
                Asking Luna…
              </>
            ) : (
              <>
                <Wand2 aria-hidden className="size-4" />
                Preview changes
              </>
            )}
          </Button>
          <Button type="button" variant="ghost" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
        </div>
      )}

      {result && diff && (stage === "preview" || stage === "applying") && (
        <>
          <EditPlanPreview diff={diff} warnings={result.warnings} />
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy || nothingToApply} onClick={() => void apply()}>
              {stage === "applying" ? "Applying…" : applyLabel}
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
