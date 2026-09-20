"use client";

import { Folder, FolderOpen, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { CopyButton } from "@/components/domain/copy-button";
import { MethodLabel } from "@/components/domain/method-label";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { createId } from "@/lib/ids";
import { groupRoutes, uniquePath } from "@/lib/routes";
import { baseUrl } from "@/lib/slug";
import type { Model, Project, Route } from "@/lib/types";
import { useProjectStore } from "@/store/project-store";
import { EndpointPreview } from "./endpoint-preview";
import { NewResourceRow } from "./new-resource-row";
import { TreeNode } from "./tree-node";

const ORIGIN = "localhost:3000";

/** `posInSet`/`setSize` count siblings at the item's own level, not rows in the flat list. */
type TreeItem = { key: string; posInSet: number; setSize: number } & (
  | { kind: "resource"; model: Model | null; title: string; count: number }
  | { kind: "endpoint"; route: Route; parentKey: string }
);

function flatten(project: Project, collapsed: ReadonlySet<string>): TreeItem[] {
  const groups = groupRoutes(project);
  const items: TreeItem[] = [];
  groups.forEach((group, groupIndex) => {
    const title = group.model ? group.model.name : "Other endpoints";
    items.push({
      kind: "resource",
      key: group.key,
      model: group.model,
      title,
      count: group.routes.length,
      posInSet: groupIndex + 1,
      setSize: groups.length,
    });
    if (collapsed.has(group.key)) return;
    group.routes.forEach((route, routeIndex) => {
      items.push({
        kind: "endpoint",
        key: `route-${route.id}`,
        route,
        parentKey: group.key,
        posInSet: routeIndex + 1,
        setSize: group.routes.length,
      });
    });
  });
  return items;
}

/** The endpoint path with its `:param` segments picked out. */
function Path({ path }: { path: string }) {
  return (
    <span className="truncate font-mono text-xs">
      {path.split(/(:[A-Za-z][A-Za-z0-9]*)/).map((part, i) =>
        part.startsWith(":") ? (
          <span key={i} className="text-accent-ink">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </span>
  );
}

interface Props {
  /** Whether the inline "new resource" row is showing; uncontrolled when left out. */
  creating?: boolean;
  onCreatingChange?: (creating: boolean) => void;
}

export function ApiTree({ creating, onCreatingChange }: Props = {}) {
  const { project, selection, select, setRailOpen } = useWorkspace();
  const addRoutes = useProjectStore((s) => s.addRoutes);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [ownCreating, setOwnCreating] = useState(false);
  const rows = useRef(new Map<string, HTMLDivElement | null>());
  const pendingFocus = useRef<string | null>(null);

  const showNewRow = onCreatingChange ? !!creating : ownCreating;
  const setShowNewRow = onCreatingChange ?? setOwnCreating;

  const items = useMemo(() => flatten(project, collapsed), [project, collapsed]);
  const selectedKey =
    selection?.kind === "resource" ? `model-${selection.id}` : selection?.kind === "endpoint" ? `route-${selection.id}` : null;
  const activeIndex = Math.max(
    0,
    items.findIndex((item) => item.key === (activeKey ?? selectedKey)),
  );

  useEffect(() => {
    const key = pendingFocus.current;
    if (!key) return;
    pendingFocus.current = null;
    rows.current.get(key)?.focus();
  });

  function focusItem(index: number) {
    const item = items[Math.min(Math.max(index, 0), items.length - 1)];
    if (!item) return;
    setActiveKey(item.key);
    pendingFocus.current = item.key;
  }

  function toggle(key: string, open: boolean) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (open) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function selectItem(item: TreeItem) {
    setActiveKey(item.key);
    if (item.kind === "endpoint") select({ kind: "endpoint", id: item.route.id });
    else if (item.model) select({ kind: "resource", id: item.model.id });
    else {
      toggle(item.key, collapsed.has(item.key));
      return;
    }
    // On mobile the rail is a drawer over the editor: picking something means going to it.
    setRailOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const item = items[activeIndex];
    if (!item) return;
    switch (event.key) {
      case "ArrowDown":
        focusItem(activeIndex + 1);
        break;
      case "ArrowUp":
        focusItem(activeIndex - 1);
        break;
      case "Home":
        focusItem(0);
        break;
      case "End":
        focusItem(items.length - 1);
        break;
      case "ArrowRight":
        if (item.kind === "resource" && collapsed.has(item.key)) toggle(item.key, true);
        else focusItem(activeIndex + 1);
        break;
      case "ArrowLeft":
        if (item.kind === "endpoint") focusItem(items.findIndex((n) => n.key === item.parentKey));
        else if (!collapsed.has(item.key)) toggle(item.key, false);
        break;
      case "Enter":
      case " ":
      // The tree carries no destructive control, so Delete only reveals the node in the
      // editor, whose header holds the two-step delete button that does the confirming.
      case "Delete":
        selectItem(item);
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  function onCreated(model: Model) {
    setShowNewRow(false);
    setActiveKey(`model-${model.id}`);
    select({ kind: "resource", id: model.id });
    setRailOpen(false);
  }

  async function addEndpoint() {
    const selectedRoute = selection?.kind === "endpoint" ? project.routes.find((r) => r.id === selection.id) : null;
    const modelId = selection?.kind === "resource" ? selection.id : (selectedRoute?.modelId ?? null);
    const route: Route = {
      id: createId("rt"),
      method: "GET",
      path: uniquePath(project.routes),
      modelId,
      action: "custom",
      description: "",
      filters: [],
    };
    try {
      await addRoutes(project.id, [route]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the endpoint.");
      return;
    }
    setActiveKey(`route-${route.id}`);
    select({ kind: "endpoint", id: route.id });
    setRailOpen(false);
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex items-center gap-1 border-b border-line px-3 py-2">
        <span className="font-mono text-xs text-ink-3">{ORIGIN}</span>
        <span className="truncate font-mono text-xs text-ink">{baseUrl(project.slug)}</span>
        <CopyButton text={`http://${ORIGIN}${baseUrl(project.slug)}`} className="ml-auto size-6" />
      </div>

      <div role="tree" aria-label="Resources and endpoints" className="flex-1 py-1" onKeyDown={onKeyDown}>
        {items.map((item, index) => {
          const selected = item.key === selectedKey;
          const active = index === activeIndex;
          const common = {
            posInSet: item.posInSet,
            setSize: item.setSize,
            selected,
            active,
            ref: (node: HTMLDivElement | null) => {
              rows.current.set(item.key, node);
            },
          };
          if (item.kind === "resource") {
            const open = !collapsed.has(item.key);
            const Icon = open ? FolderOpen : Folder;
            return (
              <TreeNode
                key={item.key}
                {...common}
                label={item.title}
                level={1}
                expanded={open}
                onSelect={() => selectItem(item)}
              >
                <Icon aria-hidden className="size-3.5 shrink-0 text-ink-3" />
                <span className="truncate font-medium text-ink">{item.title}</span>
                <span className="ml-auto font-mono text-[11px] text-ink-3">{item.count}</span>
              </TreeNode>
            );
          }
          return (
            <HoverCard key={item.key} openDelay={300} closeDelay={100}>
              <HoverCardTrigger asChild>
                <TreeNode
                  {...common}
                  label={`${item.route.method} ${item.route.path}`}
                  level={2}
                  onSelect={() => selectItem(item)}
                >
                  <MethodLabel method={item.route.method} className="text-[11px]" />
                  <Path path={item.route.path} />
                </TreeNode>
              </HoverCardTrigger>
              <HoverCardContent side="right" align="start" className="w-96 border border-line bg-surface p-0">
                <EndpointPreview route={item.route} project={project} />
              </HoverCardContent>
            </HoverCard>
          );
        })}
      </div>

      {showNewRow && (
        <NewResourceRow project={project} onCreated={onCreated} onCancel={() => setShowNewRow(false)} />
      )}

      <div className="sticky bottom-0 flex gap-1 border-t border-line bg-rail p-2">
        <Button variant="outline" size="sm" className="h-7 flex-1 gap-1 rounded-md" onClick={() => setShowNewRow(true)}>
          <Plus className="size-3.5" />
          Resource
        </Button>
        <Button variant="outline" size="sm" className="h-7 flex-1 gap-1 rounded-md" onClick={() => void addEndpoint()}>
          <Plus className="size-3.5" />
          Endpoint
        </Button>
      </div>
    </div>
  );
}
