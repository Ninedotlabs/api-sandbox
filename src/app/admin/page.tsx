import Link from "next/link";
import { ActivityList } from "@/components/admin/activity-list";
import { AdminPage, AdminPanel } from "@/components/admin/admin-page";
import { requireAdminPage } from "@/lib/admin/guard";
import { getOverview } from "@/lib/admin/queries";

export const metadata = { title: "Admin - Universal API" };

export default async function AdminOverviewPage() {
  await requireAdminPage();
  const overview = await getOverview();

  const stats = [
    { label: "Users", value: overview.users, href: "/admin/users" },
    { label: "Admins", value: overview.admins, href: "/admin/users" },
    { label: "Projects", value: overview.projects, href: "/admin/projects" },
    { label: "Endpoints", value: overview.routes, href: "/admin/projects" },
    { label: "Records", value: overview.records, href: "/admin/projects" },
    { label: "Events, last 24h", value: overview.eventsLastDay, href: "/admin/activity" },
  ];

  return (
    <AdminPage heading="Overview" description="What's in Universal API right now, and what changed most recently.">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="rounded-lg border border-line bg-surface p-4 transition-colors hover:border-line-strong"
          >
            <p className="text-2xl font-semibold tabular-nums text-ink">{stat.value.toLocaleString()}</p>
            <p className="mt-1 text-xs text-ink-3">{stat.label}</p>
          </Link>
        ))}
      </div>
      <AdminPanel
        title="Recent activity"
        action={
          <Link href="/admin/activity" className="text-xs text-accent hover:underline">
            See all
          </Link>
        }
      >
        <ActivityList events={overview.recent} />
      </AdminPanel>
    </AdminPage>
  );
}
