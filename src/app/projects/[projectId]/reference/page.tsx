"use client";

import { BookOpen } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo } from "react";
import { EndpointDoc } from "@/components/docs/endpoint-doc";
import { ModelFieldsDoc } from "@/components/docs/model-fields-doc";
import { EmptyState } from "@/components/domain/empty-state";
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
      <div className="mx-auto max-w-4xl px-6 py-10">
        <EmptyState
          icon={BookOpen}
          title="Your reference will appear here"
          description="The reference is written automatically from your endpoints. Create one to get started."
          action={
            <Button asChild>
              <Link href={`/projects/${project.id}`}>Open the workspace</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-4xl gap-8 px-6 py-10 lg:grid-cols-[200px_1fr]">
      <nav aria-label="Reference sections" className="lg:sticky lg:top-20 lg:self-start">
        <ul className="space-y-1 text-sm">
          {[{ id: "introduction", title: "Introduction" }, ...sections].map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="block rounded-xl px-3 py-1.5 text-muted-foreground hover:bg-panel hover:text-foreground">
                {s.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <article className="min-w-0 space-y-12">
        <section id="introduction" className="scroll-mt-20 space-y-3">
          <h1 className="text-2xl font-semibold">{project.name} API</h1>
          {project.description && <p className="text-muted-foreground">{project.description}</p>}
          <p className="flex flex-wrap items-center gap-1 text-sm">
            {"Every address below starts with "}
            <code className="font-mono">{baseUrl(project.slug)}</code>
            {". Send and receive data as JSON."}
          </p>
        </section>
        {sections.map((s) => (
          <section key={s.id} id={s.id} className="scroll-mt-20 space-y-6">
            <h2 className="border-b pb-2 text-xl font-semibold">{s.title}</h2>
            {s.model && <ModelFieldsDoc model={s.model} project={project} />}
            {s.endpoints.map((e) => (
              <EndpointDoc key={e.route.id} endpoint={e} slug={project.slug} tryHref={`/projects/${project.id}?endpoint=${e.route.id}`} />
            ))}
          </section>
        ))}
      </article>
    </div>
  );
}
