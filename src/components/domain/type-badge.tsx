import { fieldTypeMeta } from "@/lib/field-types";
import type { FieldType } from "@/lib/types";

export function TypeBadge({ type }: { type: FieldType }) {
  return <span className="rounded-sm bg-panel-strong px-1.5 py-0.5 font-mono text-[11px] text-ink-2">{fieldTypeMeta(type).badge}</span>;
}
