"use client";

import { Play, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { RequestForm } from "@/components/console/request-form";
import { ResponseViewer } from "@/components/console/response-viewer";
import { RoutePicker } from "@/components/console/route-picker";
import { EmptyState } from "@/components/domain/empty-state";
import { PageHeader } from "@/components/domain/page-header";
import { Button } from "@/components/ui/button";
import { consoleService } from "@/lib/services";
import type { TestRequest, TestResponse } from "@/lib/types";
import { useUiStore } from "@/store/ui-store";
import { useCurrentProject } from "@/store/use-project";

function Console() {
  const project = useCurrentProject();
  const params = useSearchParams();
  const markProgress = useUiStore((s) => s.markProgress);
  const requested = params.get("route");
  const [routeId, setRouteId] = useState<string | null>(
    project.routes.some((r) => r.id === requested) ? requested : (project.routes[0]?.id ?? null),
  );
  const [response, setResponse] = useState<TestResponse | null>(null);
  const [sending, setSending] = useState(false);
  const route = project.routes.find((r) => r.id === routeId) ?? null;

  useEffect(() => {
    const nextRequested = params.get("route");
    // Syncs local selection with the ?route= URL param on every navigation, not just cold mount.
    if (nextRequested && project.routes.some((r) => r.id === nextRequested)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRouteId(nextRequested);
      setResponse(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  async function send(request: Omit<TestRequest, "routeId">) {
    if (!route) return;
    setSending(true);
    try {
      setResponse(await consoleService.send(project.id, { routeId: route.id, ...request }));
      markProgress(project.id, "tested");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send the request.");
    } finally {
      setSending(false);
    }
  }

  async function reset() {
    try {
      await consoleService.reset(project.id);
      setResponse(null);
      toast("Sample data reset");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reset the sample data.");
    }
  }

  if (project.routes.length === 0) {
    return (
      <EmptyState
        icon={Play}
        title="Nothing to test yet"
        description="Create some routes first, then come back to try them."
        action={
          <Button asChild>
            <Link href={`/projects/${project.id}`}>Go to Build</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="Test console"
        description="Try your routes with sample data. Nothing here affects real users."
        actions={
          <Button variant="outline" onClick={reset}>
            <RotateCcw className="size-4" /> Reset sample data
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[300px_1fr] xl:grid-cols-[300px_1fr_1fr]">
        <RoutePicker
          project={project}
          selectedId={routeId}
          onSelect={(id) => {
            setRouteId(id);
            setResponse(null);
          }}
        />
        <section className="rounded-2xl border bg-surface p-5">
          {route ? (
            <RequestForm key={route.id} project={project} route={route} sending={sending} onSend={send} />
          ) : (
            <p className="text-sm text-muted-foreground">Pick a route on the left.</p>
          )}
        </section>
        <section className="lg:col-start-2 xl:col-start-auto">
          <h2 className="mb-3 text-sm font-medium">Response</h2>
          <ResponseViewer response={response} loading={sending} />
        </section>
      </div>
    </div>
  );
}

export default function ConsolePage() {
  return (
    <Suspense>
      <Console />
    </Suspense>
  );
}
