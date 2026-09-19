import type { Project } from "./types";

export interface ChecklistStep {
  id: "model" | "fields" | "routes" | "test" | "docs";
  label: string;
  description: string;
  done: boolean;
  href: string;
  cta: string;
}

export interface ProjectProgress {
  tested?: boolean;
  viewedDocs?: boolean;
}

export function buildChecklist(project: Project, progress: ProjectProgress = {}): ChecklistStep[] {
  const base = `/projects/${project.id}`;
  return [
    {
      id: "model",
      label: "Create a model",
      description: "Decide what your API stores, like Customers or Orders.",
      done: project.models.length > 0,
      href: base,
      cta: "Create a model",
    },
    {
      id: "fields",
      label: "Add fields",
      description: "Describe each model with fields such as name or price.",
      done: project.models.some((m) => m.fields.length > 0),
      href: base,
      cta: "Add fields",
    },
    {
      id: "routes",
      label: "Generate routes",
      description: "Create the web addresses apps call to use your data.",
      done: project.routes.length > 0,
      href: base,
      cta: "Set up routes",
    },
    {
      id: "test",
      label: "Test a route",
      description: "Send a request and see the response with sample data.",
      done: !!progress.tested,
      href: `${base}/console`,
      cta: "Open the test console",
    },
    {
      id: "docs",
      label: "View docs",
      description: "See the documentation we wrote for you.",
      done: !!progress.viewedDocs,
      href: `${base}/docs`,
      cta: "View docs",
    },
  ];
}
