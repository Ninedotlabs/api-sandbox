import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivityList } from "@/components/admin/activity-list";
import { AdminPage, AdminPanel, EmptyRow } from "@/components/admin/admin-page";
import { RoleToggle } from "@/components/admin/role-toggle";
import { ProjectsTable, RoleBadge } from "@/components/admin/tables";
import { requireAdminPage } from "@/lib/admin/guard";
import { getUserDetail } from "@/lib/admin/queries";
import { timeAgo } from "@/lib/format";

export const metadata = { title: "User - Admin - Universal API" };

export default async function AdminUserPage({ params }: { params: Promise<{ userId: string }> }) {
  await requireAdminPage();
  const { userId } = await params;
  const detail = await getUserDetail(userId);
  if (!detail) notFound();
  const { user, projects, tokens, sessions, activity } = detail;

  return (
    <AdminPage heading={user.email ?? user.id} description={user.name ?? "No name on this account."}>
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface p-4 text-sm text-ink-2">
        <RoleBadge role={user.role} />
        <span>Joined {timeAgo(user.createdAt)}</span>
        <span>·</span>
        <span>Last active {user.lastActiveAt ? timeAgo(user.lastActiveAt) : "never"}</span>
        <span className="ml-auto">
          <RoleToggle userId={user.id} role={user.role} email={user.email} />
        </span>
      </div>

      <AdminPanel title={`Projects (${projects.length})`}>
        <ProjectsTable projects={projects} showOwner={false} />
      </AdminPanel>

      <div className="grid gap-6 md:grid-cols-2">
        <AdminPanel title={`API tokens (${tokens.length})`}>
          {tokens.length === 0 ? (
            <EmptyRow>No tokens.</EmptyRow>
          ) : (
            <ul className="divide-y divide-line">
              {tokens.map((token) => (
                <li key={token.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span className="truncate text-ink">{token.name}</span>
                  <span className="shrink-0 text-xs text-ink-3">
                    {token.lastUsedAt ? `Used ${timeAgo(token.lastUsedAt)}` : "Never used"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </AdminPanel>
        <AdminPanel title={`Active sessions (${sessions.length})`}>
          {sessions.length === 0 ? (
            <EmptyRow>Not signed in anywhere.</EmptyRow>
          ) : (
            <ul className="divide-y divide-line">
              {sessions.map((session, index) => (
                <li key={`${session.expires}-${index}`} className="px-4 py-3 text-sm text-ink-2">
                  Expires {timeAgo(session.expires)}
                </li>
              ))}
            </ul>
          )}
        </AdminPanel>
      </div>

      <AdminPanel
        title="Activity"
        action={
          <Link href={`/admin/activity?user=${user.id}`} className="text-xs text-accent hover:underline">
            Full history
          </Link>
        }
      >
        <ActivityList events={activity} showActor={false} />
      </AdminPanel>
    </AdminPage>
  );
}
