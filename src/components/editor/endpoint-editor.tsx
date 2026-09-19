"use client";

import { Play } from "lucide-react";
import { toast } from "sonner";
import { InlineEdit } from "@/components/domain/inline-edit";
import { MethodLabel, PathText } from "@/components/domain/method-label";
import { TwoStepButton } from "@/components/domain/two-step-button";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { exampleRequest } from "@/lib/examples";
import { baseUrl } from "@/lib/slug";
import type { Route } from "@/lib/types";
import { useProjectStore } from "@/store/project-store";
import { EditorHeader } from "./editor-header";
import { RequestTab } from "./request-tab";
import { ResponseTab } from "./response-tab";
import { UseItTab } from "./use-it-tab";

/** Everything about one endpoint: its shape, its response and the code that calls it. */
export function EndpointEditor({ route }: { route: Route }) {
  const { project, select, loadInConsole, setConsoleOpen } = useWorkspace();
  const saveRoute = useProjectStore((s) => s.saveRoute);
  const deleteRoute = useProjectStore((s) => s.deleteRoute);
  const restoreRoute = useProjectStore((s) => s.restoreRoute);

  async function save(next: Route) {
    try {
      await saveRoute(project.id, next);
      toast("Endpoint saved");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not save the endpoint.";
      toast.error(message);
      throw new Error(message);
    }
  }

  function sendInConsole() {
    loadInConsole(route.id, { body: exampleRequest(route, project) ?? undefined });
    setConsoleOpen(true);
  }

  async function remove() {
    try {
      const removed = await deleteRoute(project.id, route.id);
      select(null);
      toast(`${route.method} ${route.path} deleted`, {
        action: {
          label: "Undo",
          onClick: () =>
            void restoreRoute(project.id, removed).catch((e) =>
              toast.error(e instanceof Error ? e.message : "Could not undo."),
            ),
        },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete the endpoint.");
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <EditorHeader
        kicker="Endpoint"
        title={
          <>
            <MethodLabel method={route.method} />
            <PathText path={`${baseUrl(project.slug)}${route.path}`} className="text-base break-all" />
          </>
        }
        description={
          <InlineEdit
            value={route.description}
            ariaLabel="Endpoint description"
            className="min-w-32 px-1 text-[13px] text-ink-2"
            onSave={(description) => save({ ...route, description })}
          />
        }
        actions={
          <>
            <Button size="sm" onClick={sendInConsole}>
              <Play className="size-3.5" /> Send in console
            </Button>
            <TwoStepButton label="Delete" confirmLabel="Sure? Delete" onConfirm={() => void remove()} />
          </>
        }
      />

      <Tabs defaultValue="request" className="flex-1">
        <div className="border-b border-line px-6">
          <TabsList variant="line">
            <TabsTrigger value="request">Request</TabsTrigger>
            <TabsTrigger value="response">Response</TabsTrigger>
            <TabsTrigger value="use-it">Use it</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="request" className="p-6">
          <RequestTab project={project} route={route} onSave={save} />
        </TabsContent>
        <TabsContent value="response" className="p-6">
          <ResponseTab project={project} route={route} />
        </TabsContent>
        <TabsContent value="use-it" className="p-6">
          <UseItTab project={project} route={route} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
