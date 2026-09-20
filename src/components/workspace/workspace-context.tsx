"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
  const pathname = usePathname();
  const params = useSearchParams();
  const fromUrl = readSelection(params);
  const urlKey = selectionKey(fromUrl);

  // Selection is owned by the URL, mirrored in state so select() shows immediately
  // (router.replace re-renders a tick later). Re-syncs whenever the URL changes underneath.
  const [state, setState] = useState({ seenUrlKey: urlKey, selection: fromUrl });
  if (state.seenUrlKey !== urlKey) setState({ seenUrlKey: urlKey, selection: fromUrl });

  // An explicit loadInConsole wins over the selection, but only until the selection moves again:
  // the stamp records which selection it was loaded against, so the console follows the tree after.
  const [loaded, setLoaded] = useState<{ routeId: string; draft: ConsoleDraft | null; stamp: string } | null>(null);
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
      router.replace(query ? `?${query}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  const { selection } = state;
  const selectedKey = selectionKey(selection);

  const loadInConsole = useCallback(
    (routeId: string, draft?: ConsoleDraft) => {
      setLoaded({ routeId, draft: draft ?? null, stamp: selectedKey });
    },
    [selectedKey],
  );

  const active = loaded?.stamp === selectedKey ? loaded : null;
  const value = useMemo<WorkspaceValue>(
    () => ({
      project,
      selection,
      select,
      consoleRouteId: active?.routeId ?? (selection?.kind === "endpoint" ? selection.id : null),
      consoleDraft: active?.draft ?? null,
      loadInConsole,
      consoleOpen,
      setConsoleOpen,
      railOpen,
      setRailOpen,
    }),
    [project, selection, select, active, loadInConsole, consoleOpen, railOpen],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceValue {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("useWorkspace must be used inside a WorkspaceProvider");
  return value;
}
