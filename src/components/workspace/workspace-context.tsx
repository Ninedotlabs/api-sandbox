"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { Project, TestRequest } from "@/lib/types";

export type Selection = { kind: "resource"; id: string } | { kind: "endpoint"; id: string } | null;

/** Everything the console needs besides the endpoint itself. */
export type ConsoleDraft = Partial<Omit<TestRequest, "routeId">>;

export interface WorkspaceValue {
  project: Project;
  selection: Selection;
  select(selection: Selection): void;
  /** The endpoint loaded in the console; falls back to the selected endpoint. */
  consoleRouteId: string | null;
  consoleDraft: ConsoleDraft | null;
  loadInConsole(routeId: string, draft?: ConsoleDraft): void;
  consoleOpen: boolean;
  setConsoleOpen(open: boolean): void;
  railOpen: boolean;
  setRailOpen(open: boolean): void;
}

const WorkspaceContext = createContext<WorkspaceValue | null>(null);

function readSelection(params: URLSearchParams): Selection {
  const resource = params.get("resource");
  if (resource) return { kind: "resource", id: resource };
  const endpoint = params.get("endpoint");
  if (endpoint) return { kind: "endpoint", id: endpoint };
  return null;
}

function selectionKey(selection: Selection): string {
  return selection ? `${selection.kind}:${selection.id}` : "";
}

export function WorkspaceProvider({ project, children }: { project: Project; children: React.ReactNode }) {
  const router = useRouter();
  const params = useSearchParams();
  const fromUrl = readSelection(params);
  const urlKey = selectionKey(fromUrl);

  // Selection is owned by the URL, mirrored in state so select() shows immediately
  // (router.replace re-renders a tick later). Re-syncs whenever the URL changes underneath.
  const [state, setState] = useState({ seenUrlKey: urlKey, selection: fromUrl });
  if (state.seenUrlKey !== urlKey) setState({ seenUrlKey: urlKey, selection: fromUrl });

  const [loaded, setLoaded] = useState<{ routeId: string; draft: ConsoleDraft | null } | null>(null);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(false);

  const select = useCallback(
    (selection: Selection) => {
      setState((s) => ({ ...s, selection }));
      const next = new URLSearchParams(params.toString());
      next.delete("resource");
      next.delete("endpoint");
      if (selection) next.set(selection.kind, selection.id);
      const query = next.toString();
      router.replace(query ? `?${query}` : "?", { scroll: false });
    },
    [params, router],
  );

  const loadInConsole = useCallback((routeId: string, draft?: ConsoleDraft) => {
    setLoaded({ routeId, draft: draft ?? null });
  }, []);

  const { selection } = state;
  const value = useMemo<WorkspaceValue>(
    () => ({
      project,
      selection,
      select,
      consoleRouteId: loaded?.routeId ?? (selection?.kind === "endpoint" ? selection.id : null),
      consoleDraft: loaded?.draft ?? null,
      loadInConsole,
      consoleOpen,
      setConsoleOpen,
      railOpen,
      setRailOpen,
    }),
    [project, selection, select, loaded, loadInConsole, consoleOpen, railOpen],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceValue {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("useWorkspace must be used inside a WorkspaceProvider");
  return value;
}
