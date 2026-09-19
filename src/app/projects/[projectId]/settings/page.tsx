"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/domain/page-header";
import { TwoStepButton } from "@/components/domain/two-step-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { validateProjectName, validateSlug } from "@/lib/validation";
import { useProjectStore } from "@/store/project-store";
import { useCurrentProject } from "@/store/use-project";

export default function SettingsPage() {
  const project = useCurrentProject();
  const projects = useProjectStore((s) => s.projects);
  const updateProject = useProjectStore((s) => s.updateProject);
  const deleteProject = useProjectStore((s) => s.deleteProject);
  const restoreProject = useProjectStore((s) => s.restoreProject);
  const router = useRouter();
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [slug, setSlug] = useState(project.slug);
  const [errors, setErrors] = useState<{ name?: string; slug?: string }>({});

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const next = {
      name: validateProjectName(name, projects, project.id) ?? undefined,
      slug: validateSlug(slug, projects, project.id) ?? undefined,
    };
    setErrors(next);
    if (next.name || next.slug) return;
    try {
      await updateProject(project.id, { name: name.trim(), description: description.trim(), slug });
      toast.success("Settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the settings.");
    }
  }

  async function remove() {
    try {
      const snapshot = await deleteProject(project.id);
      router.push("/projects");
      toast(`${snapshot.name} deleted`, {
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              await restoreProject(snapshot);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Could not undo.");
            }
          },
        },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete the API.");
    }
  }

  return (
    <div className="max-w-2xl space-y-8">
      <PageHeader title="Settings" description="Rename your API or change its address." />
      <form onSubmit={save} className="space-y-5 rounded-2xl border bg-card p-5 shadow-card">
        <div className="space-y-2">
          <Label htmlFor="settings-name">API name</Label>
          <Input id="settings-name" value={name} aria-invalid={!!errors.name} onChange={(e) => setName(e.target.value)} />
          {errors.name && <p role="alert" className="text-sm text-destructive">{errors.name}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="settings-description">Description</Label>
          <Textarea id="settings-description" value={description} maxLength={200} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="settings-slug">Address</Label>
          <div className="flex items-center gap-2">
            <code className="font-mono text-sm text-muted-foreground">/api/</code>
            <Input id="settings-slug" className="font-mono" value={slug} aria-invalid={!!errors.slug} onChange={(e) => setSlug(e.target.value)} />
          </div>
          {errors.slug && <p role="alert" className="text-sm text-destructive">{errors.slug}</p>}
        </div>
        <div className="flex justify-end">
          <Button type="submit">Save settings</Button>
        </div>
      </form>

      <Card className="rounded-2xl border-pastel-rose-ink/30 shadow-card">
        <CardHeader>
          <CardTitle className="text-destructive">Delete this API</CardTitle>
          <CardDescription>Removes its models, routes and docs. You can undo right after.</CardDescription>
        </CardHeader>
        <CardContent>
          <TwoStepButton label="Delete API" confirmLabel="Sure? Delete" onConfirm={() => void remove()} />
        </CardContent>
      </Card>
    </div>
  );
}
