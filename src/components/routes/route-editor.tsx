"use client";

import { useState } from "react";
import { HelpHint } from "@/components/domain/help-hint";
import { PathText } from "@/components/domain/method-label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ACTION_META, ACTIONS } from "@/lib/actions";
import { METHOD_META, METHODS } from "@/lib/methods";
import { baseUrl } from "@/lib/slug";
import type { HttpMethod, Project, Route, RouteAction } from "@/lib/types";
import { validateRoute } from "@/lib/validation";

const NONE = "none";

interface Props {
  project: Project;
  route: Route;
  onSave: (route: Route) => Promise<void> | void;
}

/** The shape of one endpoint: action, resource, method, path and list filters. */
export function RouteEditor({ project, route, onSave }: Props) {
  const [draft, setDraft] = useState<Route>(route);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const model = project.models.find((m) => m.id === draft.modelId) ?? null;
  const dirty = JSON.stringify(draft) !== JSON.stringify(route);

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
    <form onSubmit={save} className="space-y-4 rounded-lg border border-line bg-panel/60 p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="route-name">Friendly name</Label>
          <Input
            id="route-name"
            value={draft.description}
            placeholder="List all customers"
            onChange={(e) => set({ description: e.target.value })}
          />
        </div>

        <div className="space-y-1.5">
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
          <p className="text-xs text-ink-3">{ACTION_META[draft.action].description}</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="route-model">Which resource?</Label>
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

        <div className="space-y-1.5">
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
                  <span className="text-ink-3">· {METHOD_META[m].label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="route-path">Path</Label>
        <Input
          id="route-path"
          value={draft.path}
          className="font-mono"
          aria-invalid={!!error}
          aria-describedby="route-path-preview"
          onChange={(e) => set({ path: e.target.value })}
        />
        <p id="route-path-preview" className="flex flex-wrap items-center gap-1 break-all text-xs text-ink-3">
          Full address:
          <span className="font-mono text-ink-2">{baseUrl(project.slug)}</span>
          <PathText path={draft.path} className="text-ink-2" />
        </p>
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
          <p className="text-xs text-ink-3">
            Example: <code className="font-mono">?{draft.filters[0] ?? model.fields[0].name}=value</code>
          </p>
        </fieldset>
      )}

      {(!model || draft.action === "custom") && (
        <p className="text-xs text-warning">
          This route has no model action yet. Link it to a model to return data.
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2">
        {dirty && <span className="mr-auto text-xs text-warning">Unsaved changes</span>}
        <Button type="submit" size="sm" disabled={saving || !dirty}>
          {saving ? "Saving…" : "Save route"}
        </Button>
      </div>
    </form>
  );
}
