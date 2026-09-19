"use client";

import { Check } from "lucide-react";
import { Kicker } from "@/components/domain/kicker";
import { Button } from "@/components/ui/button";
import type { ChecklistStep } from "@/lib/onboarding";
import { cn } from "@/lib/utils";

export interface LifecycleActions {
  define: () => void;
  mock: () => void;
  request: () => void;
  respond: () => void;
}

interface Props {
  steps: ChecklistStep[];
  actions: LifecycleActions;
}

type Phase = keyof LifecycleActions;

const PHASES: { id: Phase; kicker: string; title: string; description: string; cta: string }[] = [
  {
    id: "define",
    kicker: "DEFINE",
    title: "A resource and its schema",
    description: "Name what your API stores and give it fields.",
    cta: "Add a resource",
  },
  {
    id: "mock",
    kicker: "MOCK",
    title: "Endpoints over that resource",
    description: "Generate the standard endpoints and their sample data.",
    cta: "Create endpoints",
  },
  {
    id: "request",
    kicker: "REQUEST",
    title: "A call from the console",
    description: "Send a real request to the mock server.",
    cta: "Send a request",
  },
  {
    id: "respond",
    kicker: "RESPOND",
    title: "The response, documented",
    description: "Read the JSON you get back and share the reference.",
    cta: "Open reference",
  },
];

function isDone(steps: ChecklistStep[], phase: Phase): boolean {
  const done = (id: ChecklistStep["id"]) => steps.some((s) => s.id === id && s.done);
  if (phase === "define") return done("model");
  if (phase === "mock") return done("fields") && done("routes");
  if (phase === "request") return done("test");
  return done("docs");
}

/** The four lifecycle steps the editor shows while nothing is selected. */
export function LifecycleGuide({ steps, actions }: Props) {
  const states = PHASES.map((phase) => isDone(steps, phase.id));
  const currentIndex = states.indexOf(false);

  return (
    <section aria-label="API lifecycle" className="p-6">
      <Kicker>Getting started</Kicker>
      <h1 className="mt-1 text-xl font-semibold tracking-[-0.01em] text-ink">Define · Mock · Request · Respond</h1>
      <p className="mt-1 text-sm text-ink-2">Four steps from an empty project to an API you can call.</p>

      <ol className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {PHASES.map((phase, index) => {
          const done = states[index];
          const current = index === currentIndex;
          return (
            <li
              key={phase.id}
              aria-label={phase.kicker}
              data-state={done ? "done" : current ? "current" : "todo"}
              className={cn(
                "relative flex flex-col gap-2 rounded-lg border p-4",
                current ? "border-accent bg-accent-soft/30" : "border-line bg-panel/60",
              )}
            >
              {index < PHASES.length - 1 && (
                <span aria-hidden className="absolute top-8 -right-3 hidden h-px w-3 bg-line-strong xl:block" />
              )}
              <span className="flex items-center gap-2">
                <span
                  aria-hidden
                  className={cn(
                    "flex size-5 items-center justify-center rounded-sm font-mono text-[11px] font-semibold",
                    done ? "bg-accent text-white" : current ? "bg-accent-soft text-accent-ink" : "bg-panel-strong text-ink-3",
                  )}
                >
                  {done ? <Check className="size-3" /> : index + 1}
                </span>
                <span className={cn("kicker", current && "text-accent-ink")}>{phase.kicker}</span>
              </span>
              <p className="text-sm font-medium text-ink">{phase.title}</p>
              <p className="text-[13px] text-ink-2">{phase.description}</p>
              <Button
                variant={current ? "default" : "outline"}
                size="sm"
                className="mt-auto w-fit rounded-md"
                onClick={actions[phase.id]}
              >
                {phase.cta}
              </Button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
