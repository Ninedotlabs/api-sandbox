"use client";

import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { SampleDataTable } from "@/components/models/sample-data-table";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { Button } from "@/components/ui/button";
import { consoleService } from "@/lib/services";
import type { Model } from "@/lib/types";

/** The mock records behind a resource, with the project-wide reset. */
export function DataTab({ model }: { model: Model }) {
  const { project } = useWorkspace();
  // Bumped after a reset so the table refetches.
  const [nonce, setNonce] = useState(0);
  const [busy, setBusy] = useState(false);

  async function reset() {
    setBusy(true);
    try {
      await consoleService.reset(project.id);
      setNonce((n) => n + 1);
      toast("Sample data reset");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reset the sample data.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] text-ink-2">
          {"Records generated to match the schema. Send requests from the console to change them."}
        </p>
        <Button variant="secondary" size="sm" className="shrink-0" disabled={busy} onClick={reset}>
          <RotateCcw className="size-3.5" /> Reset sample data
        </Button>
      </div>
      <SampleDataTable key={nonce} projectId={project.id} model={model} />
    </div>
  );
}
