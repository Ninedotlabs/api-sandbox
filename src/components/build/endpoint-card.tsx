import { Plus, RotateCcw, Wand2 } from "lucide-react";
import { CopyButton } from "@/components/domain/copy-button";
import { UrlSegments } from "@/components/domain/url-segments";
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
    <Button variant="secondary" className="rounded-xl" disabled={generateCount === 0} onClick={onGenerateAll}>
      <Wand2 className="size-4" /> Generate all
    </Button>
  );
  return (
    <section className="rounded-2xl border bg-card shadow-card">
      <div className="flex flex-wrap items-center gap-3 p-5">
        <div className="min-w-0 flex-1">
          <h2 className="mb-2 text-lg font-semibold">API endpoint</h2>
          <p className="flex flex-wrap items-center gap-1 text-sm text-ink-muted">
            <span>http://localhost:3000</span>
            <UrlSegments slug={project.slug} tail="/:resource" />
          </p>
        </div>
        <CopyButton text={baseUrl(project.slug)} />
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-b-2xl border-t bg-soft/60 p-4">
        <Button className="rounded-xl" onClick={onNewModel}>
          <Plus className="size-4" /> New model
        </Button>
        <div className="ml-auto flex flex-wrap gap-2">
          {generateCount === 0 ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0}>{generate}</span>
              </TooltipTrigger>
              <TooltipContent>Every model already has its endpoints</TooltipContent>
            </Tooltip>
          ) : (
            generate
          )}
          <Button variant="secondary" className="rounded-xl" onClick={onResetData}>
            <RotateCcw className="size-4" /> Reset data
          </Button>
        </div>
      </div>
    </section>
  );
}
