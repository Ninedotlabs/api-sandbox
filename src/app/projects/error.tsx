"use client";

import { AlertTriangle } from "lucide-react";
import { DashboardShell } from "@/components/shell/dashboard-shell";
import { Button } from "@/components/ui/button";

export default function ProjectsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <DashboardShell title="Projects" description="Your API workspace">
      <main className="mx-auto flex max-w-xl flex-col items-center px-6 py-24 text-center">
        <span className="mb-4 rounded-full bg-danger/10 p-3 text-danger"><AlertTriangle aria-hidden /></span>
        <h1 className="text-xl font-semibold text-ink">We couldn&apos;t load your workspace</h1>
        <p className="mt-2 text-sm text-ink-3">Check the database connection, then try again. Your saved projects have not been changed.</p>
        <Button className="mt-6" onClick={reset}>Try again</Button>
      </main>
    </DashboardShell>
  );
}
