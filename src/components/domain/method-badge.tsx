import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { METHOD_META } from "@/lib/methods";
import type { HttpMethod } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  method: HttpMethod;
  showLabel?: boolean;
  tooltip?: boolean;
  className?: string;
}

export function MethodBadge({ method, showLabel = false, tooltip = true, className }: Props) {
  const meta = METHOD_META[method];
  const badge = (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide",
        meta.className,
        className,
      )}
    >
      {method}
      {showLabel && <span className="font-medium opacity-80">· {meta.label}</span>}
    </span>
  );
  if (!tooltip) return badge;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent>
        {meta.label}: {meta.hint}
      </TooltipContent>
    </Tooltip>
  );
}
