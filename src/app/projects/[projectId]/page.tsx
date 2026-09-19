"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { EndpointCard } from "@/components/build/endpoint-card";
import { GettingStartedStrip } from "@/components/build/getting-started-strip";
import { NewModelCard } from "@/components/build/new-model-card";
import { OtherRoutesCard } from "@/components/build/other-routes-card";
import { ResourceCard, type Panel } from "@/components/build/resource-card";
import { generateAllCrud } from "@/lib/crud";
import { countLabel } from "@/lib/format";
import { buildChecklist } from "@/lib/onboarding";
import { groupRoutes } from "@/lib/routes";
import { consoleService } from "@/lib/services";
import { useProjectStore } from "@/store/project-store";
import { useUiStore } from "@/store/ui-store";
import { useCurrentProject } from "@/store/use-project";

function Build() {
  const project = useCurrentProject();
  const params = useSearchParams();
  const addRoutes = useProjectStore((s) => s.addRoutes);
  const progress = useUiStore((s) => s.progress[project.id]);
  const [open, setOpen] = useState<Record<string, Panel | null>>(() => {
    const requested = params.get("model");
    return requested ? { [requested]: "fields" } : {};
  });
  const [adding, setAdding] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const modelIds = project.models.map((m) => m.id).join(",");

  const fetchCounts = useCallback(async () => {
    const entries = await Promise.all(
      project.models.map(async (m) => [m.id, (await consoleService.sampleData(project.id, m.id)).length] as const),
    );
    return Object.fromEntries(entries) as Record<string, number>;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, modelIds]);

  useEffect(() => {
    let cancelled = false;
    fetchCounts().then((next) => {
      if (!cancelled) setCounts(next);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchCounts]);

  const pending = generateAllCrud(project);
  const other = groupRoutes(project).find((g) => g.key === "other")?.routes ?? [];
  const maxCount = Math.max(0, ...Object.values(counts));
  const steps = buildChecklist(project, progress);

  async function generateAll() {
    try {
      await addRoutes(project.id, pending);
      toast.success(`${countLabel(pending.length, "endpoint")} created`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the endpoints.");
    }
  }

  async function resetData() {
    try {
      await consoleService.reset(project.id);
      setCounts(await fetchCounts());
      toast("Sample data reset");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reset the sample data.");
    }
  }

  return (
    <div className="space-y-5">
      <GettingStartedStrip steps={steps} />
      <EndpointCard
        project={project}
        generateCount={pending.length}
        onNewModel={() => setAdding(true)}
        onGenerateAll={generateAll}
        onResetData={resetData}
      />
      <div className="space-y-3">
        {project.models.map((m) => (
          <ResourceCard
            key={m.id}
            project={project}
            model={m}
            recordCount={counts[m.id] ?? 0}
            maxCount={maxCount}
            openPanel={open[m.id] ?? null}
            onToggle={(panel) => setOpen((o) => ({ ...o, [m.id]: o[m.id] === panel ? null : panel }))}
          />
        ))}
        {adding && (
          <NewModelCard
            project={project}
            onCreated={(model) => {
              setAdding(false);
              setOpen((o) => ({ ...o, [model.id]: "fields" }));
              toast.success(`${model.name} created. Add its fields below.`);
            }}
            onCancel={() => setAdding(false)}
          />
        )}
        {project.models.length === 0 && !adding && (
          <p className="px-1 text-sm text-ink-muted">{"No models yet. Press “New model” to describe the first thing your API stores."}</p>
        )}
        {other.length > 0 && <OtherRoutesCard project={project} routes={other} />}
      </div>
    </div>
  );
}

export default function BuildPage() {
  return (
    <Suspense>
      <Build />
    </Suspense>
  );
}
