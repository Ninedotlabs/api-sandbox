"use client";

import { ModelList } from "@/components/models/model-list";
import { useCurrentProject } from "@/store/use-project";

export default function ModelsLayout({ children }: { children: React.ReactNode }) {
  const project = useCurrentProject();
  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      <ModelList project={project} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
