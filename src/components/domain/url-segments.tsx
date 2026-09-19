import { cn } from "@/lib/utils";

interface Props {
  slug: string;
  tail?: string;
  className?: string;
}

const PILL = "rounded-lg px-2 py-1 font-semibold";

export function UrlSegments({ slug, tail, className }: Props) {
  return (
    <span role="group" aria-label="API address" className={cn("inline-flex flex-wrap items-center gap-1 font-mono text-sm", className)}>
      <span className={cn(PILL, "bg-pastel-blue text-pastel-blue-ink")}>/api</span>
      <span className={cn(PILL, "bg-pastel-violet text-pastel-violet-ink")}>/{slug}</span>
      {tail && <span className={cn(PILL, "bg-pastel-peach text-pastel-peach-ink")}>{tail}</span>}
    </span>
  );
}
