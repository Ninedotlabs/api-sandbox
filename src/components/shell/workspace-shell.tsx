"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { useMediaQuery } from "@/lib/use-media-query";

interface Props {
  rail: React.ReactNode;
  editor: React.ReactNode;
  console: React.ReactNode;
}

/**
 * Three panes under the 48px top bar: rail · editor · console.
 * Below 1100px the console becomes a right drawer, below 768px the rail becomes a left drawer.
 * Each pane is mounted exactly once — in the grid or in its drawer, never both — so the
 * tree and the console keep a single set of ids, listeners and focus state.
 */
export function WorkspaceShell({ rail, editor, console: consolePane }: Props) {
  const { railOpen, setRailOpen, consoleOpen, setConsoleOpen } = useWorkspace();
  const railInGrid = useMediaQuery("(min-width: 768px)");
  const consoleInGrid = useMediaQuery("(min-width: 1100px)");

  return (
    <div
      className={
        consoleInGrid
          ? "grid h-[calc(100vh-48px)] grid-cols-[280px_1fr_380px]"
          : railInGrid
            ? "grid h-[calc(100vh-48px)] grid-cols-[280px_1fr]"
            : "grid h-[calc(100vh-48px)] grid-cols-[1fr]"
      }
    >
      {railInGrid && <aside className="overflow-y-auto border-r border-line bg-rail">{rail}</aside>}
      <main className="min-w-0 overflow-y-auto bg-surface">{editor}</main>
      {consoleInGrid && <aside className="overflow-y-auto border-l border-line bg-page">{consolePane}</aside>}

      {!railInGrid && (
        <Sheet open={railOpen} onOpenChange={setRailOpen}>
          <SheetContent side="left" className="w-[280px] gap-0 overflow-y-auto bg-rail p-0 sm:max-w-[280px]">
            <SheetHeader className="sr-only">
              <SheetTitle>Resources and endpoints</SheetTitle>
            </SheetHeader>
            {rail}
          </SheetContent>
        </Sheet>
      )}

      {!consoleInGrid && (
        <Sheet open={consoleOpen} onOpenChange={setConsoleOpen}>
          <SheetContent side="right" className="w-[380px] gap-0 overflow-y-auto bg-page p-0 sm:max-w-[380px]">
            <SheetHeader className="sr-only">
              <SheetTitle>Console</SheetTitle>
            </SheetHeader>
            {consolePane}
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
