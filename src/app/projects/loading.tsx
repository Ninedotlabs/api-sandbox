import { DashboardShell } from "@/components/shell/dashboard-shell";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProjectsLoading() {
  return (
    <DashboardShell title="Projects" description="Loading your API workspace…">
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-6 md:py-8" aria-label="Loading projects">
        <Skeleton className="h-56 w-full rounded-2xl" />
        <div className="space-y-3">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      </main>
    </DashboardShell>
  );
}
