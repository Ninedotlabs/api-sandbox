"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useWorkspace } from "@/components/workspace/workspace-context";

interface Props {
  rail: React.ReactNode;
  editor: React.ReactNode;
  console: React.ReactNode;
}

/**
 * Three panes under the 48px top bar: rail · editor · console.
 * Below 1100px the console becomes a right drawer, below 768px the rail becomes a left drawer.
 */
export function WorkspaceShell({ rail, editor, console: consolePane }: Props) {
  const { railOpen, setRailOpen, consoleOpen, setConsoleOpen } = useWorkspace();

  return (
    <div className="grid h-[calc(100vh-48px)] grid-cols-[1fr] md:grid-cols-[280px_1fr] min-[1100px]:grid-cols-[280px_1fr_380px]">
      <aside className="hidden overflow-y-auto border-r border-line bg-rail md:block">{rail}</aside>
      <main className="min-w-0 overflow-y-auto bg-surface">{editor}</main>
      <aside className="hidden overflow-y-auto border-l border-line bg-page min-[1100px]:block">{consolePane}</aside>

      <Sheet open={railOpen} onOpenChange={setRailOpen}>
        <SheetContent side="left" className="w-[280px] gap-0 overflow-y-auto bg-rail p-0 sm:max-w-[280px]">
          <SheetHeader className="sr-only">
            <SheetTitle>Resources and endpoints</SheetTitle>
          </SheetHeader>
          {rail}
        </SheetContent>
      </Sheet>

      <Sheet open={consoleOpen} onOpenChange={setConsoleOpen}>
        <SheetContent side="right" className="w-[380px] gap-0 overflow-y-auto bg-page p-0 sm:max-w-[380px]">
          <SheetHeader className="sr-only">
            <SheetTitle>Console</SheetTitle>
          </SheetHeader>
          {consolePane}
        </SheetContent>
      </Sheet>
    </div>
  );
}
