"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";
import { DashboardShell } from "@/components/shell/dashboard-shell";
import { Button } from "@/components/ui/button";

/** Catches anything thrown under /projects - a failed data load or a crash while rendering -
 * so the copy stays neutral about the cause, and the error is logged so it isn't swallowed. */
export default function ProjectsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <DashboardShell title="Projects" description="Your API workspace">
      <main className="mx-auto flex max-w-xl flex-col items-center px-6 py-24 text-center">
        <span className="mb-4 rounded-full bg-danger/10 p-3 text-danger"><AlertTriangle aria-hidden /></span>
        <h1 className="text-xl font-semibold text-ink">Something went wrong</h1>
        <p className="mt-2 text-sm text-ink-3">This page hit an error. Try again, or reload if it keeps happening. Your saved projects have not been changed.</p>
        {error.digest && <p className="mt-3 font-mono text-xs text-ink-3">Reference: {error.digest}</p>}
        <Button className="mt-6" onClick={reset}>Try again</Button>
      </main>
    </DashboardShell>
  );
}
