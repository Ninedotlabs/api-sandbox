"use client";

import { Terminal } from "lucide-react";
import { siJavascript, siPython } from "simple-icons";
import { CodePanel } from "@/components/domain/code-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { exampleRequest } from "@/lib/examples";
import { buildSnippets } from "@/lib/snippets";
import type { Project, Route } from "@/lib/types";

function Mark({ path }: { path: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-4 fill-current">
      <path d={path} />
    </svg>
  );
}

/** Ready-to-paste calls to this endpoint, in the three languages the reference uses. */
export function UseItTab({ project, route }: { project: Project; route: Route }) {
  const body = exampleRequest(route, project) ?? undefined;
  const snippets = buildSnippets(project, route, body);

  const languages = [
    { value: "curl", label: "cURL", code: snippets.curl, mark: <Terminal aria-hidden className="size-4" /> },
    { value: "javascript", label: "JavaScript", code: snippets.javascript, mark: <Mark path={siJavascript.path} /> },
    { value: "python", label: "Python", code: snippets.python, mark: <Mark path={siPython.path} /> },
  ];

  return (
    <Tabs defaultValue="curl" className="gap-3">
      <TabsList variant="line" className="border-b border-line">
        {languages.map((l) => (
          <TabsTrigger key={l.value} value={l.value}>
            <span className="text-ink-2">{l.mark}</span>
            {l.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {languages.map((l) => (
        <TabsContent key={l.value} value={l.value}>
          <CodePanel code={l.code} language="text" title={l.label.toUpperCase()} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
