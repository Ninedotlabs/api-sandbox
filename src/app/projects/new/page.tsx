"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { toast } from "sonner";
import { CreateProjectWizard } from "@/components/dashboard/create-project-wizard";
import { DashboardHeader } from "@/components/shell/dashboard-header";
import { TEMPLATES } from "@/lib/templates";
import type { TemplateId } from "@/lib/types";
import { useProjectStore } from "@/store/project-store";
import { useProjects } from "@/store/use-project";

function NewProject() {
  const params = useSearchParams();
  const requested = params.get("template");
  const initialTemplate = TEMPLATES.some((t) => t.id === requested) ? (requested as TemplateId) : null;
  const { projects } = useProjects();
  const createProject = useProjectStore((s) => s.createProject);
  const router = useRouter();

  return (
    <div className="min-h-screen">
      <DashboardHeader />
      <main className="px-4 py-10">
        <CreateProjectWizard
          existingProjects={projects}
          initialTemplate={initialTemplate}
          onCreate={async (input) => {
            const project = await createProject(input);
            toast.success(`${project.name} is ready`);
            router.push(`/projects/${project.id}`);
          }}
        />
      </main>
    </div>
  );
}

export default function NewProjectPage() {
  return (
    <Suspense>
      <NewProject />
    </Suspense>
  );
}
