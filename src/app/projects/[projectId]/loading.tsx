import { Skeleton } from "@/components/ui/skeleton";

export default function ProjectLoading() {
  return (
    <div className="min-h-screen bg-page" aria-label="Loading project workspace">
      <div className="flex h-12 items-center gap-3 border-b border-line bg-surface px-4">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-5 w-40" />
      </div>
      <div className="grid h-[calc(100vh-48px)] grid-cols-1 md:grid-cols-[280px_1fr] xl:grid-cols-[280px_1fr_380px]">
        <div className="hidden space-y-3 border-r border-line bg-rail p-4 md:block">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-6 w-5/6" />
        </div>
        <div className="space-y-5 bg-surface p-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
        <div className="hidden space-y-3 border-l border-line bg-page p-4 xl:block">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
