"use client";

import { SampleDataTable } from "@/components/models/sample-data-table";
import type { Model, Project } from "@/lib/types";

export function ResourceDataPanel({ project, model }: { project: Project; model: Model }) {
  return <SampleDataTable projectId={project.id} model={model} />;
}
