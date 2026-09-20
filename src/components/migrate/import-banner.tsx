"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { importLocalProjects, markMigrated, projectsToOffer, type ImportOutcome } from "@/lib/migrate-local";
import type { Project } from "@/lib/types";
import { useProjectStore } from "@/store/project-store";

type Stage =
  | { kind: "checking" }
  | { kind: "hidden" }
  | { kind: "offer"; projects: Project[] }
  | { kind: "importing"; projects: Project[] }
  | { kind: "done"; results: ImportOutcome[] };

/**
 * The one-time nudge to move a browser's local APIs into the account. Never imports on its
 * own - the user always picks Import or Not now - and never removes anything from
 * localStorage, whatever the outcome (see `src/lib/migrate-local.ts`).
 */
export function ImportBanner() {
  const [stage, setStage] = useState<Stage>({ kind: "checking" });
  const loadProjects = useProjectStore((s) => s.loadProjects);

  useEffect(() => {
    let live = true;
    projectsToOffer().then((projects) => {
      if (live) setStage(projects.length > 0 ? { kind: "offer", projects } : { kind: "hidden" });
    });
    return () => {
      live = false;
    };
    // Checked once per mount: the answer ("does the server already have projects") doesn't
    // change from anything this component itself does besides the import it triggers below.
  }, []);

  if (stage.kind === "checking" || stage.kind === "hidden") return null;

  async function runImport(projects: Project[]) {
    setStage({ kind: "importing", projects });
    const results = await importLocalProjects(projects);
    // Written once the user has acted on the offer, whatever came of it - a failed project
    // stays in localStorage with its reason shown below, and won't be nagged about again
    // (the banner's other gate, an empty server list, is likely gone anyway once even one
    // project has landed).
    markMigrated();
    setStage({ kind: "done", results });
    await loadProjects();
  }

  if (stage.kind === "done") {
    const succeeded = stage.results.filter((r) => r.ok);
    const failed = stage.results.filter((r) => !r.ok);
    return (
      <div role="status" className="flex flex-col gap-2 border-b border-line bg-panel px-4 py-3 text-[13px]">
        <p className="text-ink-2">
          {succeeded.length} of {stage.results.length} APIs moved to your account.
        </p>
        {failed.length > 0 && (
          <ul className="space-y-1 text-ink-3">
            {failed.map((r) => (
              <li key={r.id}>
                <span className="font-medium text-ink-2">{r.name}</span>: {r.error} It stays in this browser; nothing was lost.
              </li>
            ))}
          </ul>
        )}
        <div>
          <Button size="sm" variant="ghost" onClick={() => setStage({ kind: "hidden" })}>
            Dismiss
          </Button>
        </div>
      </div>
    );
  }

  const { projects } = stage;
  const importing = stage.kind === "importing";
  return (
    <div role="region" aria-label="Import your local APIs" className="flex items-center justify-between gap-3 border-b border-line bg-panel px-4 py-3 text-[13px]">
      <p className="text-ink-2">
        Found {projects.length} {projects.length === 1 ? "API" : "APIs"} saved in this browser. Move them to your account?
      </p>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" onClick={() => void runImport(projects)} disabled={importing}>
          {importing ? "Importing…" : "Import"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setStage({ kind: "hidden" })} disabled={importing}>
          Not now
        </Button>
      </div>
    </div>
  );
}
