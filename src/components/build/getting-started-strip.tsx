import { Check } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { ChecklistStep } from "@/lib/onboarding";
import { cn } from "@/lib/utils";

export function GettingStartedStrip({ steps }: { steps: ChecklistStep[] }) {
  const next = steps.find((s) => !s.done);
  if (!next) return null;
  return (
    <section aria-label="Getting started" className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card px-4 py-3 shadow-card">
      <ol className="flex flex-wrap gap-1.5">
        {steps.map((s, i) => (
          <li
            key={s.id}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs",
              s.done ? "bg-pastel-mint text-pastel-mint-ink" : s.id === next.id ? "bg-pastel-blue text-pastel-blue-ink" : "bg-soft text-ink-muted",
            )}
          >
            {s.done ? <Check className="size-3" aria-label="done" /> : <span>{i + 1}</span>}
            {s.label}
          </li>
        ))}
      </ol>
      <Button size="sm" className="ml-auto rounded-xl" asChild>
        <Link href={next.href}>{next.cta}</Link>
      </Button>
    </section>
  );
}
