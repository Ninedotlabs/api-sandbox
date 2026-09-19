"use client";

import { WorkspaceShell } from "@/components/shell/workspace-shell";

// The panes land in Task 5; the shell and its responsive behaviour are already in place.
export default function WorkspacePage() {
  return (
    <WorkspaceShell
      rail={<div />}
      editor={
        <div className="p-6">
          <p className="text-sm text-ink-3">Select a resource</p>
        </div>
      }
      console={<div />}
    />
  );
}
