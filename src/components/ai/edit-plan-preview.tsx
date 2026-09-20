"use client";

import { Kicker } from "@/components/domain/kicker";
import { MethodLabel } from "@/components/domain/method-label";
import { TypeBadge } from "@/components/domain/type-badge";
import { fieldChangeDetails, type EditDiff, type RemovalsDiff, type ResourceDiff } from "@/lib/ai/diff";
import { countLabel } from "@/lib/format";

function ResourceBlock({ resource }: { resource: ResourceDiff }) {
  return (
    <section aria-label={resource.name} className="rounded-lg border border-line bg-panel/60 p-4">
      <h3 className="text-sm font-semibold text-ink">{resource.name}</h3>
      {resource.fields.length > 0 && (
        <ul className="mt-3 space-y-1">
          {resource.fields.map((change) => (
            <li key={change.name} className="flex flex-wrap items-center gap-2 text-[13px]">
              <span className="font-mono text-ink">{change.name}</span>
              <TypeBadge type={change.after.type} />
              {change.kind === "added" ? (
                <span className="text-[11px] text-ink-3">new</span>
              ) : (
                // Every attribute that differs, not just type — a field can be re-listed
                // with only its required/unique/options/linkTo changed, and each of those
                // is a change to the underlying record data just as much as a type change.
                fieldChangeDetails(change.before!, change.after).map((line) => (
                  <span key={line} className="text-[11px] text-ink-3">
                    {line}
                  </span>
                ))
              )}
            </li>
          ))}
        </ul>
      )}
      {resource.recordCount > 0 && (
        <p className="mt-3 text-[13px] text-ink-2">
          {resource.isNew
            ? `Starts with ${countLabel(resource.recordCount, "sample record")}.`
            : `Replaces this resource's sample data with ${countLabel(resource.recordCount, "record")}.`}
        </p>
      )}
      {resource.inboundLinks.map((link) => (
        <p key={`${link.modelName}.${link.fieldName}`} className="mt-2 text-[13px] text-warning">
          {/* "Up to" because recordCount is the linking model's total record count, not how
              many of them actually have this link field set — an upper bound, not a fact. */}
          Up to {countLabel(link.recordCount, `${link.modelName} record`)} may lose {link.recordCount === 1 ? "its" : "their"} link to this
          resource.
        </p>
      ))}
    </section>
  );
}

/** Removals get their own section, last, in the danger colour — this is the user's consent
 * step, so it states consequences (real counts), never just names. */
function RemovalsSection({ removals }: { removals: RemovalsDiff }) {
  const total = removals.resources.length + removals.fields.length + removals.endpoints.length;
  if (total === 0) return null;
  return (
    <div className="space-y-2">
      <Kicker className="text-danger">Removals</Kicker>
      <div className="space-y-2">
        {removals.resources.map((r) => (
          <div key={r.name} className="rounded-lg border border-danger/40 bg-danger/5 p-3">
            <p className="text-[13px] font-medium text-danger">
              {r.name} — deletes {countLabel(r.recordCount, "record")} and {countLabel(r.endpointCount, "endpoint")}
            </p>
            {r.inboundLinks.map((link) => (
              <p key={`${link.modelName}.${link.fieldName}`} className="mt-1 text-[13px] text-danger">
                {link.modelName}.{link.fieldName} will be cleared
              </p>
            ))}
          </div>
        ))}
        {removals.fields.map((f) => (
          <p key={`${f.resource}.${f.field}`} className="rounded-lg border border-danger/40 bg-danger/5 p-3 text-[13px] text-danger">
            {f.resource}.{f.field} — {countLabel(f.recordCount, "record")} will lose this value
          </p>
        ))}
        {removals.endpoints.map((e) => (
          <div key={`${e.method} ${e.path}`} className="flex flex-wrap items-center gap-2 rounded-lg border border-danger/40 bg-danger/5 p-3">
            <MethodLabel method={e.method} />
            <span className="font-mono text-[13px] text-danger">{e.path}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** The four-section diff, shown before anything is applied. */
export function EditPlanPreview({ diff, warnings }: { diff: EditDiff; warnings: string[] }) {
  const removalCount = diff.removals.resources.length + diff.removals.fields.length + diff.removals.endpoints.length;
  const nothing = diff.newResources.length === 0 && diff.changedResources.length === 0 && diff.newEndpoints.length === 0 && removalCount === 0;
  return (
    <div className="space-y-4">
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
      {nothing && <p className="text-sm text-ink-2">Nothing to change here — try describing it differently.</p>}
      {diff.newResources.length > 0 && (
        <div className="space-y-2">
          <Kicker>New resources</Kicker>
          {diff.newResources.map((r) => (
            <ResourceBlock key={r.name} resource={r} />
          ))}
        </div>
      )}
      {diff.changedResources.length > 0 && (
        <div className="space-y-2">
          <Kicker>Changed resources</Kicker>
          {diff.changedResources.map((r) => (
            <ResourceBlock key={r.name} resource={r} />
          ))}
        </div>
      )}
      {diff.newEndpoints.length > 0 && (
        <div className="space-y-2">
          <Kicker>New endpoints</Kicker>
          <ul className="space-y-1">
            {diff.newEndpoints.map((e) => (
              <li key={`${e.method} ${e.path}`} className="flex flex-wrap items-center gap-2">
                <MethodLabel method={e.method} />
                <span className="font-mono text-[13px] text-ink-2">{e.path}</span>
                <span className="text-[13px] text-ink-3">{e.description}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <RemovalsSection removals={diff.removals} />
    </div>
  );
}
