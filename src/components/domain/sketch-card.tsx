import { cn } from "@/lib/utils";

export function SketchCard({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border-[1.5px] border-dashed border-sketch transition-all duration-150 hover:border-solid hover:border-line hover:bg-card hover:shadow-card",
        className,
      )}
      {...props}
    />
  );
}
