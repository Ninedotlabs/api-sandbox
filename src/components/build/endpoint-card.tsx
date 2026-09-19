import { Plus, RotateCcw, Wand2 } from "lucide-react";
import { CopyButton } from "@/components/domain/copy-button";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { baseUrl } from "@/lib/slug";
import type { Project } from "@/lib/types";

interface Props {
  project: Project;
  generateCount: number;
  onNewModel: () => void;
  onGenerateAll: () => void;
  onResetData: () => void;
}

export function EndpointCard({ project, generateCount, onNewModel, onGenerateAll, onResetData }: Props) {
  const generate = (
    <Button variant="secondary" disabled={generateCount === 0} onClick={onGenerateAll}>
      <Wand2 className="size-4" /> Create all endpoints
    </Button>
  );
  return (
    <section className="rounded-2xl border bg-surface">
      <div className="flex flex-wrap items-center gap-3 p-6">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold">Your API lives at</h2>
          <p className="mt-2 flex flex-wrap items-center gap-1.5 text-base text-ink-3">
            <code className="font-mono">{baseUrl(project.slug)}/:resource</code>
          </p>
        </div>
        <CopyButton text={baseUrl(project.slug)} />
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-b-2xl border-t bg-panel/60 px-6 py-4">
        <Button onClick={onNewModel}>
          <Plus className="size-4" /> New model
        </Button>
        <div className="ml-auto flex flex-wrap gap-2">
          {generateCount === 0 ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0} role="button" aria-disabled="true" aria-label="Create all endpoints">
                  {generate}
                </span>
              </TooltipTrigger>
              <TooltipContent>Every model already has its endpoints</TooltipContent>
            </Tooltip>
          ) : (
            generate
          )}
          <Button variant="secondary" onClick={onResetData}>
            <RotateCcw className="size-4" /> Reset sample data
          </Button>
        </div>
      </div>
    </section>
  );
}
