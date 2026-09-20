"use client";

import { CodePanel } from "@/components/domain/code-panel";
import { MethodLabel } from "@/components/domain/method-label";
import { TypeBadge } from "@/components/domain/type-badge";
import type { ApiPlan, PlanResource } from "@/lib/ai/plan";
import { crudOptions } from "@/lib/crud";
import { countLabel } from "@/lib/format";
import type { Model } from "@/lib/types";

/** crudOptions only reads the name, so a stand-in model is enough to preview the paths. */
const asModel = (resource: PlanResource): Model => ({ id: resource.name, name: resource.name, fields: [] });

function ResourceCard({ resource }: { resource: PlanResource }) {
  const sample = resource.records.slice(0, 2);
  return (
    <section aria-label={resource.name} className="rounded-lg border border-line bg-panel/60 p-4">
      <h3 className="text-sm font-semibold text-ink">{resource.name}</h3>
      {resource.description && <p className="mt-0.5 text-[13px] text-ink-2">{resource.description}</p>}

      <ul className="mt-3 space-y-1">
        {resource.fields.map((field) => (
          <li key={field.name} className="flex items-center gap-2 text-[13px]">
            <span className="font-mono text-ink">{field.name}</span>
            <TypeBadge type={field.type} />
            {field.required && <span className="text-[11px] text-ink-3">required</span>}
            {field.unique && <span className="text-[11px] text-ink-3">unique</span>}
          </li>
        ))}
      </ul>

      <ul className="mt-3 space-y-1">
        {crudOptions(asModel(resource)).map((option) => (
          <li key={option.action} className="flex items-center gap-2">
            <MethodLabel method={option.method} />
            <span className="font-mono text-[13px] text-ink-2">{option.path}</span>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-[13px] text-ink-2">{countLabel(resource.records.length, "sample record")}</p>
      {sample.length > 0 && <CodePanel className="mt-2" tone="light" code={JSON.stringify(sample, null, 2)} />}
    </section>
  );
}

/** What the model proposed, shown before anything is created. */
export function PlanPreview({ plan, warnings }: { plan: ApiPlan; warnings: string[] }) {
  return (
    <div className="space-y-3">
      {warnings.length > 0 && (
        <div className="rounded-lg border border-warning/40 bg-warning/5 p-3">
          <p className="text-[13px] font-medium text-warning">Adjustments made to the plan</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[13px] text-ink-2">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
      {plan.resources.map((resource) => (
        <ResourceCard key={resource.name} resource={resource} />
      ))}
    </div>
  );
}
