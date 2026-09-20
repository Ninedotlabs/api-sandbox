"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Kicker } from "@/components/domain/kicker";
import { MethodLabel } from "@/components/domain/method-label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWorkspace, type ConsoleDraft } from "@/components/workspace/workspace-context";
import { groupRoutes } from "@/lib/routes";
import { consoleService, type LogEntry } from "@/lib/services";
import type { TestResponse } from "@/lib/types";
import { useUiStore } from "@/store/ui-store";
import { MockStrip } from "./mock-strip";
import { RequestForm } from "./request-form";
import { RequestLog } from "./request-log";
import { ResponsePanel } from "./response-panel";

interface Loaded {
  /** The context values this state was seeded from, so an outside load (or ⌘K) resets the panel. */
  seenRouteId: string | null;
  seenDraft: ConsoleDraft | null;
  routeId: string | null;
  draft: ConsoleDraft | null;
  /** Bumped on every load so the form remounts and re-reads `initial`. */
  seq: number;
  response: TestResponse | null;
}

/** The always-on third pane: choose an endpoint, send it, read what the mock server said. */
export function ConsolePanel() {
  const { project, consoleRouteId, consoleDraft, loadInConsole } = useWorkspace();
  const markProgress = useUiStore((s) => s.markProgress);
  const [sending, setSending] = useState(false);
  /** Identifies the newest send, so earlier ones can be discarded when they land late. */
  const sendSeq = useRef(0);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loaded, setLoaded] = useState<Loaded>(() => ({
    seenRouteId: consoleRouteId,
    seenDraft: consoleDraft,
    routeId: consoleRouteId,
    draft: consoleDraft,
    seq: 0,
    response: null,
  }));

  if (loaded.seenRouteId !== consoleRouteId || loaded.seenDraft !== consoleDraft) {
    setLoaded((s) => ({
      seenRouteId: consoleRouteId,
      seenDraft: consoleDraft,
      routeId: consoleRouteId,
      draft: consoleDraft,
      seq: s.seq + 1,
      response: null,
    }));
  }

  useEffect(() => {
    let live = true;
    consoleService
      .log(project.id)
      .then((log) => {
        if (live) setEntries(log);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Could not load the request log."));
    return () => {
      live = false;
    };
  }, [project.id]);

  const route = loaded.routeId ? (project.routes.find((r) => r.id === loaded.routeId) ?? null) : null;
  const groups = groupRoutes(project).filter((g) => g.routes.length > 0);

  function pick(routeId: string) {
    // Set both: the context may already hold this endpoint after a replay moved the panel elsewhere.
    setLoaded((s) => ({
      seenRouteId: routeId,
      seenDraft: null,
      routeId,
      draft: null,
      seq: s.seq + 1,
      response: null,
    }));
    loadInConsole(routeId);
  }

  function replay(entry: LogEntry) {
    const draft: ConsoleDraft = { params: entry.request.params, query: entry.request.query, body: entry.request.body };
    setLoaded((s) => ({
      seenRouteId: entry.routeId,
      seenDraft: draft,
      routeId: entry.routeId,
      draft,
      seq: s.seq + 1,
      response: entry.response,
    }));
    loadInConsole(entry.routeId, draft);
  }

  async function send(request: { params: Record<string, string>; query: Record<string, string>; body: unknown }) {
    if (!route) return;
    // A send in flight belongs to the endpoint it started on. If the user picks another endpoint,
    // replays a log row or sends again before it lands, its response is stale: the log still records
    // it, but it must not overwrite the panel or clear the spinner under whatever is current now.
    const id = ++sendSeq.current;
    const routeId = route.id;
    setSending(true);
    try {
      const response = await consoleService.send(project.id, { routeId, ...request });
      setLoaded((s) => (id === sendSeq.current && s.routeId === routeId ? { ...s, response } : s));
      markProgress(project.id, "tested");
      setEntries(await consoleService.log(project.id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send the request.");
    } finally {
      if (id === sendSeq.current) setSending(false);
    }
  }

  async function clear() {
    try {
      await consoleService.clearLog(project.id);
      setEntries([]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not clear the log.");
    }
  }

  return (
    <div className="flex min-h-full flex-col gap-4 p-4">
      <div className="space-y-2">
        <Kicker>Console</Kicker>
        <Select value={route?.id ?? ""} onValueChange={pick}>
          <SelectTrigger aria-label="Endpoint" size="sm" className="w-full font-mono">
            <SelectValue placeholder="Choose an endpoint" />
          </SelectTrigger>
          <SelectContent>
            {groups.map((group) => (
              <SelectGroup key={group.key}>
                <SelectLabel className="font-mono text-[11px]">{group.title}</SelectLabel>
                {group.routes.map((r) => (
                  <SelectItem key={r.id} value={r.id} textValue={`${r.method} ${r.path}`} className="font-mono">
                    <MethodLabel method={r.method} />
                    {/* The space keeps the accessible name "POST /products" rather than "POST/products". */}
                    {" "}
                    <span className="truncate">{r.path}</span>
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>

      {route ? (
        <div className="rounded-lg border border-line bg-panel p-3">
          <RequestForm
            key={`${route.id}:${loaded.seq}`}
            project={project}
            route={route}
            sending={sending}
            initial={loaded.draft ?? undefined}
            onSend={send}
          />
        </div>
      ) : (
        <p className="rounded-lg border border-line bg-panel p-3 text-[13px] text-ink-3">
          {groups.length === 0
            ? "No endpoints yet. Create a resource and its endpoints to send a request."
            : "Choose an endpoint to build a request."}
        </p>
      )}

      <MockStrip sending={sending} slug={project.slug} />
      <ResponsePanel response={loaded.response} loading={sending} />
      <RequestLog entries={entries} onReplay={replay} onClear={clear} />
    </div>
  );
}
