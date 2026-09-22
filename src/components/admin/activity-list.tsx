import Link from "next/link";
import { describeEvent } from "@/lib/admin/describe";
import type { ActivityEvent } from "@/lib/admin/queries";
import { timeAgo } from "@/lib/format";
import { EmptyRow } from "./admin-page";

const CHANNEL_LABELS: Record<ActivityEvent["channel"], string> = {
  ui: "Browser",
  api: "API",
  mcp: "MCP",
  auth: "Sign-in",
};

export function ActivityList({ events, showActor = true }: { events: ActivityEvent[]; showActor?: boolean }) {
  if (events.length === 0) return <EmptyRow>No activity recorded yet.</EmptyRow>;
  return (
    <ul className="divide-y divide-line">
      {events.map((event) => (
        <li key={event.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-ink">{describeEvent(event)}</p>
            <p className="truncate text-xs text-ink-3">
              {showActor &&
                (event.actorUserId ? (
                  <Link href={`/admin/users/${event.actorUserId}`} className="hover:text-ink hover:underline">
                    {event.actorEmail ?? event.actorUserId}
                  </Link>
                ) : (
                  <span>{event.actorEmail ?? "Unknown user"}</span>
                ))}
              {showActor && " · "}
              <span className="font-mono">{event.action}</span>
              {event.projectId && event.projectName && (
                <>
                  {" · "}
                  <Link href={`/projects/${event.projectId}`} className="hover:text-ink hover:underline">
                    {event.projectName}
                  </Link>
                </>
              )}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 text-xs text-ink-3">
            <span className="rounded-full border border-line px-2 py-0.5">{CHANNEL_LABELS[event.channel]}</span>
            <time dateTime={event.createdAt} title={new Date(event.createdAt).toUTCString()}>
              {timeAgo(event.createdAt)}
            </time>
          </div>
        </li>
      ))}
    </ul>
  );
}
