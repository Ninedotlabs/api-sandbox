import { MethodBadge } from "@/components/domain/method-badge";
import { groupRoutes } from "@/lib/routes";
import type { Project } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  project: Project;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function RoutePicker({ project, selectedId, onSelect }: Props) {
  return (
    <nav aria-label="Routes to test" className="space-y-4">
      {groupRoutes(project)
        .filter((g) => g.routes.length > 0)
        .map((g) => (
          <div key={g.key} className="space-y-1">
            <h3 className="px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{g.title}</h3>
            {g.routes.map((r) => (
              <button
                key={r.id}
                type="button"
                aria-pressed={r.id === selectedId}
                onClick={() => onSelect(r.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors duration-150 hover:bg-accent",
                  r.id === selectedId && "bg-primary/10",
                )}
              >
                <MethodBadge method={r.method} tooltip={false} className="w-16 justify-center" />
                <span className="min-w-0 truncate">{r.description || r.path}</span>
              </button>
            ))}
          </div>
        ))}
    </nav>
  );
}
