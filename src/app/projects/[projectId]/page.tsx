"use client";

import { PartyPopper } from "lucide-react";
import Link from "next/link";
import { CopyButton } from "@/components/domain/copy-button";
import { PageHeader } from "@/components/domain/page-header";
import { OnboardingChecklist } from "@/components/home/onboarding-checklist";
import { Card, CardContent } from "@/components/ui/card";
import { buildChecklist } from "@/lib/onboarding";
import { baseUrl } from "@/lib/slug";
import { useUiStore } from "@/store/ui-store";
import { useCurrentProject } from "@/store/use-project";

export default function ProjectHome() {
  const project = useCurrentProject();
  const progress = useUiStore((s) => s.progress[project.id]);
  const steps = buildChecklist(project, progress);
  const fieldCount = project.models.reduce((n, m) => n + m.fields.length, 0);
  const stats = [
    { label: "Models", value: project.models.length, href: `/projects/${project.id}/models` },
    { label: "Routes", value: project.routes.length, href: `/projects/${project.id}/routes` },
    { label: "Fields", value: fieldCount, href: `/projects/${project.id}/models` },
  ];

  return (
    <div className="space-y-8">
      <PageHeader title={project.name} description={project.description || "Your API at a glance."} />
      <div className="flex items-center gap-3 rounded-[10px] border bg-surface px-4 py-3">
        <span className="text-sm text-muted-foreground">Base URL</span>
        <code className="min-w-0 truncate font-mono text-sm">{baseUrl(project.slug)}</code>
        <CopyButton text={baseUrl(project.slug)} className="ml-auto" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="rounded-[10px] border bg-surface-2 p-5 transition-colors duration-150 hover:border-primary/50">
            <p className="text-sm text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-3xl font-semibold">{s.value}</p>
          </Link>
        ))}
      </div>
      {steps.every((s) => s.done) ? (
        <Card>
          <CardContent className="flex items-center gap-3 py-6">
            <PartyPopper className="size-6 text-primary" />
            <div>
              <p className="font-medium">{"You're all set"}</p>
              <p className="text-sm text-muted-foreground">Your API has models, routes, tests and docs.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <OnboardingChecklist steps={steps} />
      )}
    </div>
  );
}
