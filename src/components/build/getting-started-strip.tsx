import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { ChecklistStep } from "@/lib/onboarding";

interface Props {
  steps: ChecklistStep[];
  /** Steps that can be done right here on the page; the rest link to their screen. */
  actions?: Partial<Record<ChecklistStep["id"], () => void>>;
}

export function GettingStartedStrip({ steps, actions = {} }: Props) {
  const index = steps.findIndex((s) => !s.done);
  if (index < 0) return null;
  const next = steps[index];
  const action = actions[next.id];
  return (
    <section aria-label="Getting started" className="flex flex-wrap items-center gap-4 rounded-2xl border bg-card px-5 py-4 shadow-card">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-pastel-blue-ink">
          Step {index + 1} of {steps.length}
        </p>
        <p className="mt-0.5 font-semibold">{next.label}</p>
        <p className="text-sm text-ink-muted">{next.description}</p>
      </div>
      {action ? (
        <Button onClick={action}>{next.cta}</Button>
      ) : (
        <Button asChild>
          <Link href={next.href}>{next.cta}</Link>
        </Button>
      )}
    </section>
  );
}
