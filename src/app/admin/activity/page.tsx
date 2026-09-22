import Link from "next/link";
import { ActivityList } from "@/components/admin/activity-list";
import { AdminPage, AdminPanel } from "@/components/admin/admin-page";
import { Button } from "@/components/ui/button";
import { ACTIVITY_CHANNELS, type ActivityChannel } from "@/lib/activity/record";
import { requireAdminPage } from "@/lib/admin/guard";
import { ACTIVITY_PAGE_SIZE, listActivity, listActivityActions, listUsers } from "@/lib/admin/queries";

export const metadata = { title: "Activity - Admin - Universal API" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function single(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return v?.trim() || undefined;
}

const SELECT = "h-9 rounded-md border border-line bg-surface px-2 text-sm text-ink";

export default async function AdminActivityPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdminPage();
  const params = await searchParams;
  const userId = single(params.user);
  const action = single(params.action);
  const channelParam = single(params.channel);
  const channel = ACTIVITY_CHANNELS.includes(channelParam as ActivityChannel) ? (channelParam as ActivityChannel) : undefined;
  const page = Math.max(1, Number(single(params.page)) || 1);

  const [{ events, total }, actions, users] = await Promise.all([
    listActivity({ userId, action, channel, page }),
    listActivityActions(),
    listUsers(),
  ]);
  const pages = Math.max(1, Math.ceil(total / ACTIVITY_PAGE_SIZE));

  function pageHref(target: number): string {
    const query = new URLSearchParams();
    if (userId) query.set("user", userId);
    if (action) query.set("action", action);
    if (channel) query.set("channel", channel);
    query.set("page", String(target));
    return `/admin/activity?${query}`;
  }

  return (
    <AdminPage
      heading="Activity"
      description="Sign-ins and every change made through the browser, the API or MCP. Calls to public mock endpoints aren't logged."
    >
      {/* A plain GET form: filtering works without client JavaScript and every view is a shareable URL. */}
      <form method="get" className="flex flex-wrap items-end gap-2">
        <label className="space-y-1 text-xs text-ink-3">
          <span className="block">User</span>
          <select name="user" defaultValue={userId ?? ""} className={SELECT}>
            <option value="">Everyone</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.email ?? user.id}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs text-ink-3">
          <span className="block">Action</span>
          <select name="action" defaultValue={action ?? ""} className={SELECT}>
            <option value="">All actions</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs text-ink-3">
          <span className="block">Channel</span>
          <select name="channel" defaultValue={channel ?? ""} className={SELECT}>
            <option value="">All channels</option>
            {ACTIVITY_CHANNELS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" size="sm" className="h-9 rounded-md">
          Filter
        </Button>
        {(userId || action || channel) && (
          <Button asChild variant="ghost" size="sm" className="h-9 rounded-md">
            <Link href="/admin/activity">Clear</Link>
          </Button>
        )}
      </form>

      <AdminPanel title={`${total.toLocaleString()} event${total === 1 ? "" : "s"}`}>
        <ActivityList events={events} />
      </AdminPanel>

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm text-ink-3">
          <span>
            Page {page} of {pages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Button asChild variant="outline" size="sm" className="rounded-md">
                <Link href={pageHref(page - 1)}>Newer</Link>
              </Button>
            )}
            {page < pages && (
              <Button asChild variant="outline" size="sm" className="rounded-md">
                <Link href={pageHref(page + 1)}>Older</Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </AdminPage>
  );
}
