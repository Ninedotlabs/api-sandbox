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

/** An endpoint path with its `:param` segments picked out. */
export function PathText({ path, className }: { path: string; className?: string }) {
  return (
    <span className={cn("font-mono", className)}>
      {path.split(/(:[A-Za-z][A-Za-z0-9]*)/).map((part, i) =>
        part.startsWith(":") ? (
          <span key={i} className="text-accent-ink">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </span>
  );
}
