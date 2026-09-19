"use client";

import { Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/domain/empty-state";
import { PageHeader } from "@/components/domain/page-header";
import { ProjectCard } from "@/components/domain/project-card";
import { TemplateCard } from "@/components/domain/template-card";
import { DashboardHeader } from "@/components/shell/dashboard-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TEMPLATES } from "@/lib/templates";
import { useProjects } from "@/store/use-project";

export default function ProjectsPage() {
  const { projects, loaded } = useProjects();
  const router = useRouter();

  return (
    <div className="min-h-screen">
      <DashboardHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 md:px-8">
        <PageHeader
          title="Your APIs"
          description="Each API has its own models, routes and docs."
          actions={
            projects.length > 0 && (
              <Button asChild>
                <Link href="/projects/new">
                  <Plus className="size-4" /> New API
                </Link>
              </Button>
            )
          }
        />
        {!loaded ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-40 rounded-[10px]" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="space-y-8">
            <EmptyState
              icon={Sparkles}
              title="Create your first API"
              description={"Describe the things you want to store, and we'll build the endpoints for you."}
              action={
                <Button size="lg" asChild>
                  <Link href="/projects/new">Create your first API</Link>
                </Button>
              }
            />
            <section>
              <h2 className="mb-3 text-sm font-medium text-muted-foreground">Or start from a template</h2>
              <div className="grid gap-4 sm:grid-cols-3">
                {TEMPLATES.map((t) => (
                  <TemplateCard
                    key={t.id}
                    emoji={t.emoji}
                    name={t.name}
                    description={t.description}
                    onSelect={() => router.push(`/projects/new?template=${t.id}`)}
                  />
                ))}
              </div>
            </section>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
