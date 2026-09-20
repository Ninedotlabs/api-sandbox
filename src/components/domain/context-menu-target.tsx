"use client";

import { Fragment, useState } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import type { ContextMenuItemSpec } from "@/lib/context-menu-items";
import { useUiStore } from "@/store/ui-store";

interface Props {
  items: ContextMenuItemSpec[];
  children: React.ReactNode;
  /** Passed through to the Radix trigger, so the menu attaches to the child itself. */
  asChild?: boolean;
}

/**
 * The only component that knows about Radix's ContextMenu. Wraps existing row markup, renders
 * an item spec array as menu rows, and keeps Shift+right-click reserved for the browser's own
 * menu: a capture-phase handler on the trigger stops the event before Radix's own bubble-phase
 * handler runs, so it never calls `preventDefault`.
 *
 * A plain right-click also stops propagating once it reaches this trigger (after Radix's own
 * handler has run). Targets nest — a page-background menu wraps rows that carry their own more
 * specific menu — and Radix's trigger only calls `preventDefault`, never `stopPropagation`; left
 * alone, a right-click on a row would bubble up and also pop open the background menu.
 */
export function ContextMenuTarget({ items, children, asChild }: Props) {
  const seenHint = useUiStore((s) => s.seenContextMenuHint);
  const markHintSeen = useUiStore((s) => s.markContextMenuHintSeen);
  const [showHint, setShowHint] = useState(false);

  function handleOpenChange(open: boolean) {
    if (!open) {
      setShowHint(false);
      return;
    }
    if (!seenHint) {
      setShowHint(true);
      markHintSeen();
    }
  }

  return (
    <ContextMenu onOpenChange={handleOpenChange}>
      <ContextMenuTrigger
        asChild={asChild}
        onContextMenuCapture={(event) => {
          if (event.shiftKey) event.stopPropagation();
        }}
        onContextMenu={(event) => event.stopPropagation()}
      >
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent>
        {items.map((item, index) => (
          <Fragment key={item.id}>
            {index > 0 && item.separatorBefore && <ContextMenuSeparator />}
            <ContextMenuItem
              variant={item.danger ? "destructive" : "default"}
              disabled={item.disabled}
              aria-description={item.disabledReason}
              onSelect={item.onSelect}
            >
              {item.label}
              {item.hint && <span className="ml-auto pl-4 text-xs text-ink-3">{item.hint}</span>}
            </ContextMenuItem>
          </Fragment>
        ))}
        {showHint && (
          <>
            <ContextMenuSeparator />
            <p className="px-1.5 py-1 text-[11px] text-ink-3">Shift + right-click for the browser menu</p>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
