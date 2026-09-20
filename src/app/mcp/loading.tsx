import { DashboardShell } from "@/components/shell/dashboard-shell";
import { Skeleton } from "@/components/ui/skeleton";

export default function McpLoading() {
  return (
    <DashboardShell title="MCP connection" description="Loading your connection settings…">
      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8 md:px-6" aria-label="Loading MCP settings">
        <div className="space-y-3">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-9 w-80 max-w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
        <Skeleton className="h-56 w-full rounded-xl" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </main>
    </DashboardShell>
  );
}
