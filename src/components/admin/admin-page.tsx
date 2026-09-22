import { DashboardShell } from "@/components/shell/dashboard-shell";
import { AdminNav } from "./admin-nav";

interface Props {
  heading: string;
  description: string;
  children: React.ReactNode;
}

export function AdminPage({ heading, description, children }: Props) {
  return (
    <DashboardShell title="Admin" description="Every user, project and change across Universal API.">
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-6 md:py-8">
        <AdminNav />
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-ink">{heading}</h1>
          <p className="text-sm text-ink-3">{description}</p>
        </div>
        {children}
      </main>
    </DashboardShell>
  );
}

/** A bordered panel with an optional heading, matching the project list's surface. */
export function AdminPanel({ title, children, action }: { title?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg border border-line bg-surface">
      {title && (
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function EmptyRow({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-6 text-center text-sm text-ink-3">{children}</p>;
}
