"use client";

import { SearchX } from "lucide-react";
import { useParams } from "next/navigation";
import { EmptyState } from "@/components/domain/empty-state";
import { ModelEditor } from "@/components/models/model-editor";
import { useCurrentProject } from "@/store/use-project";

export default function ModelPage() {
  const project = useCurrentProject();
  const { modelId } = useParams<{ modelId: string }>();
  const model = project.models.find((m) => m.id === modelId);
  if (!model) return <EmptyState icon={SearchX} title="Model not found" description="It may have been deleted." />;
  return <ModelEditor key={model.id} project={project} model={model} />;
}
