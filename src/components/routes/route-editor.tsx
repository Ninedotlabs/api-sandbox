"use client";

import { useMemo, useState } from "react";
import { CodeBlock } from "@/components/domain/code-block";
import { HelpHint } from "@/components/domain/help-hint";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ACTION_META, ACTIONS } from "@/lib/actions";
import { exampleResponse } from "@/lib/examples";
import { METHOD_META, METHODS } from "@/lib/methods";
import { baseUrl } from "@/lib/slug";
import type { HttpMethod, Project, Route, RouteAction } from "@/lib/types";
import { validateRoute } from "@/lib/validation";
import { PathPreview } from "./path-preview";

const NONE = "none";

interface Props {
  project: Project;
  route: Route;
  onSave: (route: Route) => Promise<void> | void;
}

export function RouteEditor({ project, route, onSave }: Props) {
  const [draft, setDraft] = useState<Route>(route);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const model = project.models.find((m) => m.id === draft.modelId) ?? null;
  const preview = useMemo(() => exampleResponse(draft, project), [draft, project]);

  const set = (patch: Partial<Route>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setError(null);
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const err = validateRoute(draft, project.routes);
    setError(err);
    if (err) return;
    setSaving(true);
    try {
      await onSave(draft);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the route.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-5 rounded-[10px] border bg-surface p-5">
        <div className="space-y-2">
          <Label htmlFor="route-name">Friendly name</Label>
          <Input id="route-name" value={draft.description} placeholder="List all customers" onChange={(e) => set({ description: e.target.value })} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="route-action" className="flex items-center gap-1.5">
            What should it do?
            <HelpHint term="an action">
              The action decides what happens when an app calls this route: read records, add one, change one or delete one.
            </HelpHint>
          </Label>
          <Select
            value={draft.action}
            onValueChange={(v) => {
              const action = v as RouteAction;
              set({ action, method: ACTION_META[action].method, filters: action === "list" ? draft.filters : [] });
            }}
          >
            <SelectTrigger id="route-action" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTIONS.map((a) => (
                <SelectItem key={a} value={a}>
                  {ACTION_META[a].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{ACTION_META[draft.action].description}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="route-model">Which model?</Label>
          <Select value={draft.modelId ?? NONE} onValueChange={(v) => set({ modelId: v === NONE ? null : v, filters: [] })}>
            <SelectTrigger id="route-model" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>None</SelectItem>
              {project.models.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
          <div className="space-y-2">
            <Label htmlFor="route-method" className="flex items-center gap-1.5">
              Method
              <HelpHint term="a method">GET reads data, POST creates, PUT and PATCH update, DELETE removes.</HelpHint>
            </Label>
            <Select value={draft.method} onValueChange={(v) => set({ method: v as HttpMethod })}>
              <SelectTrigger id="route-method" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    <span className="font-mono">{m}</span>
                    <span className="text-muted-foreground">· {METHOD_META[m].label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="route-path">Path</Label>
            <Input
              id="route-path"
              value={draft.path}
              className="font-mono"
              aria-invalid={!!error}
              aria-describedby="route-path-preview"
              onChange={(e) => set({ path: e.target.value })}
            />
            <p id="route-path-preview" className="break-all text-xs text-muted-foreground">
              Full address: <PathPreview base={baseUrl(project.slug)} path={draft.path} />
            </p>
          </div>
        </div>

        {draft.action === "list" && model && model.fields.length > 0 && (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Let callers filter by</legend>
            <div className="flex flex-wrap gap-4">
              {model.fields.map((f) => (
                <label key={f.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={draft.filters.includes(f.name)}
                    onCheckedChange={(v) =>
                      set({ filters: v === true ? [...draft.filters, f.name] : draft.filters.filter((x) => x !== f.name) })
                    }
                  />
                  <span className="font-mono">{f.name}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Example: <code className="font-mono">?{draft.filters[0] ?? model.fields[0].name}=value</code>
            </p>
          </fieldset>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save route"}
          </Button>
        </div>
      </div>

      <aside className="space-y-2">
        <h3 className="text-sm font-medium">Response preview</h3>
        <p className="text-xs text-muted-foreground">An example of what callers get back (status {preview.status}).</p>
        {preview.body === null ? (
          <CodeBlock code="(empty: 204 No Content)" language="text" />
        ) : (
          <CodeBlock code={JSON.stringify(preview.body, null, 2)} />
        )}
      </aside>
    </form>
  );
}
