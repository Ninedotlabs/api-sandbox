"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { Kicker } from "@/components/domain/kicker";
import { ReferenceIndex } from "@/components/reference/reference-index";
import { ResourceReference } from "@/components/reference/resource-reference";
import { Button } from "@/components/ui/button";
import { buildDocs } from "@/lib/docs";
import { baseUrl } from "@/lib/slug";
import { useUiStore } from "@/store/ui-store";
import { useCurrentProject } from "@/store/use-project";

export default function ReferencePage() {
  const project = useCurrentProject();
  const markProgress = useUiStore((s) => s.markProgress);
  const sections = useMemo(() => buildDocs(project), [project]);

  const hasDocs = sections.length > 0;
  useEffect(() => {
    if (hasDocs) markProgress(project.id, "viewedDocs");
  }, [project.id, hasDocs, markProgress]);

  if (!hasDocs) {
    return (
      <div className="mx-auto max-w-4xl space-y-3 px-6 py-16 text-center">
        <Kicker>Reference</Kicker>
        <h1 className="text-xl font-semibold text-ink">Your reference will appear here</h1>
        <p className="mx-auto max-w-sm text-sm text-ink-3">
          {"The reference is written automatically from your endpoints. Create one to get started."}
        </p>
        <Button asChild className="mt-4">
          <Link href={`/projects/${project.id}`}>Open the workspace</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-10 px-6 py-10 lg:flex-row">
      <ReferenceIndex sections={sections} />
      <article className="min-w-0 flex-1 space-y-12">
        <section id="introduction" className="scroll-mt-20 space-y-3">
          <Kicker>Reference</Kicker>
          <h1 className="text-2xl font-semibold text-ink">{project.name} API</h1>
          {project.description && <p className="text-ink-2">{project.description}</p>}
          <p className="flex flex-wrap items-center gap-1 text-sm text-ink-2">
            {"Every address below starts with "}
            <code className="font-mono text-ink">{baseUrl(project.slug)}</code>
            {". Send and receive data as JSON."}
          </p>
        </section>
        {sections.map((s) => (
          <ResourceReference key={s.id} section={s} project={project} />
        ))}
      </article>
    </div>
  );
}
