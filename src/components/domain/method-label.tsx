import { METHOD_META } from "@/lib/methods";
import type { HttpMethod } from "@/lib/types";
import { cn } from "@/lib/utils";

export function MethodLabel({ method, className }: { method: HttpMethod; className?: string }) {
  return (
    <span className={cn("inline-flex w-14 shrink-0 items-center justify-center rounded-sm px-1 font-mono text-[11px] font-semibold", METHOD_META[method].className, className)}>
      {method}
    </span>
  );
}
