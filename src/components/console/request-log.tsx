"use client";

import { Kicker } from "@/components/domain/kicker";
import { MethodLabel } from "@/components/domain/method-label";
import { Button } from "@/components/ui/button";
import type { LogEntry } from "@/lib/services";

interface Props {
  entries: LogEntry[];
  onReplay: (entry: LogEntry) => void;
  onClear: () => void;
}

function clockTime(iso: string): string {
  const at = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(at.getHours())}:${pad(at.getMinutes())}:${pad(at.getSeconds())}`;
}

function statusClass(status: number): string {
  if (status < 300) return "text-success";
  if (status < 500) return "text-warning";
  return "text-danger";
}

/** Everything sent this session, newest first. A row reloads its request and its response. */
export function RequestLog({ entries, onReplay, onClear }: Props) {
  const rows = entries.slice().sort((a, b) => b.at.localeCompare(a.at));

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Kicker>Log</Kicker>
        {rows.length > 0 && (
          <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs text-ink-3" onClick={onClear}>
            Clear
          </Button>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="text-[13px] text-ink-3">No requests yet.</p>
      ) : (
        <ul aria-label="Request log" className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-panel">
          {rows.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => onReplay(entry)}
                className="flex w-full items-center gap-2 px-2 py-1.5 text-left transition-colors duration-150 hover:bg-panel-strong"
              >
                <MethodLabel method={entry.method} />
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-ink">{entry.path}</span>
                <span className={`font-mono text-xs font-semibold ${statusClass(entry.response.status)}`}>
                  {entry.response.status}
                </span>
                <span className="font-mono text-xs text-ink-3">{entry.response.durationMs}ms</span>
                <span className="font-mono text-xs text-ink-3">{clockTime(entry.at)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
