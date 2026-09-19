"use client";

import { Database } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/domain/empty-state";
import { NewModelDialog } from "@/components/models/new-model-dialog";
import { Button } from "@/components/ui/button";
import { useCurrentProject } from "@/store/use-project";

export default function ModelsPage() {
  const project = useCurrentProject();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const first = project.models[0];

  useEffect(() => {
    if (first) router.replace(`/projects/${project.id}/models/${first.id}`);
  }, [first, project.id, router]);

  if (first) return null;
  return (
    <>
      <EmptyState
        icon={Database}
        title="Create your first model"
        description="A model describes one kind of thing your API stores, like Customers or Orders."
        action={<Button onClick={() => setOpen(true)}>Create a model</Button>}
      />
      <NewModelDialog project={project} open={open} onOpenChange={setOpen} />
    </>
  );
}
