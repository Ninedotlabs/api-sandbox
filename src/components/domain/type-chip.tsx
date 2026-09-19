import { fieldTypeMeta } from "@/lib/field-types";
import type { FieldType } from "@/lib/types";

export function TypeChip({ type }: { type: FieldType }) {
  const meta = fieldTypeMeta(type);
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-pastel-lemon px-2 py-0.5 text-[11px] font-semibold text-pastel-lemon-ink">
      <span aria-hidden>{meta.icon}</span>
      {meta.label}
    </span>
  );
}
