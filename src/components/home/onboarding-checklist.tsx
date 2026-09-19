import { Check } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { ChecklistStep } from "@/lib/onboarding";
import { cn } from "@/lib/utils";

export function OnboardingChecklist({ steps }: { steps: ChecklistStep[] }) {
  const doneCount = steps.filter((s) => s.done).length;
  const nextId = steps.find((s) => !s.done)?.id;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Getting started</CardTitle>
        <CardDescription>
          {doneCount} of {steps.length} done
        </CardDescription>
        <Progress value={(doneCount / steps.length) * 100} aria-label="Getting started progress" className="mt-2" />
      </CardHeader>
      <CardContent>
        <ol className="space-y-2">
          {steps.map((s, i) => (
            <li
              key={s.id}
              className={cn("flex flex-wrap items-start gap-3 rounded-md p-3", s.id === nextId && "bg-primary/5 ring-1 ring-primary/30")}
            >
              <span
                aria-hidden
                className={cn(
                  "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-xs",
                  s.done && "border-success bg-success text-white",
                )}
              >
                {s.done ? <Check className="size-3.5" /> : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm font-medium", s.done && "text-muted-foreground line-through")}>
                  {s.label}
                  {s.done && <span className="sr-only"> (done)</span>}
                </p>
                <p className="text-xs text-muted-foreground">{s.description}</p>
              </div>
              {s.id === nextId && (
                <Button size="sm" asChild>
                  <Link href={s.href}>{s.cta}</Link>
                </Button>
              )}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
