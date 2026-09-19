import { Send } from "lucide-react";
import { CopyButton } from "@/components/domain/copy-button";
import { EmptyState } from "@/components/domain/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { TestResponse } from "@/lib/types";
import { cn } from "@/lib/utils";
import { JsonTree } from "./json-tree";

const STATUS_TEXT: Record<number, { text: string; hint: string }> = {
  200: { text: "OK", hint: "It worked." },
  201: { text: "Created", hint: "The record was saved." },
  204: { text: "No Content", hint: "It worked. The record was deleted, so there's nothing to show." },
  400: { text: "Bad Request", hint: "Something in the data you sent needs fixing. See the details below." },
  404: { text: "Not Found", hint: "There's no record with that id." },
};

export function ResponseViewer({ response, loading }: { response: TestResponse | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-3 rounded-2xl border bg-surface p-4 shadow-card" aria-busy="true">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  if (!response) {
    return <EmptyState icon={Send} title="No response yet" description="Fill in the request and press Send to see what your API returns." />;
  }
  const meta = STATUS_TEXT[response.status] ?? { text: "", hint: "" };
  const tone = response.status < 300 ? "success" : response.status < 500 ? "warning" : "danger";
  const hasBody = response.body !== null && response.body !== undefined;

  return (
    <div className="space-y-3" aria-live="polite">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 font-mono text-sm font-semibold",
            tone === "success" && "bg-pastel-mint text-pastel-mint-ink",
            tone === "warning" && "bg-pastel-peach text-pastel-peach-ink",
            tone === "danger" && "bg-pastel-rose text-pastel-rose-ink",
          )}
        >
          {`${response.status} ${meta.text}`.trim()}
        </span>
        <span className="text-sm text-muted-foreground">{response.durationMs} ms</span>
      </div>
      {meta.hint && <p className="text-sm text-muted-foreground">{meta.hint}</p>}
      {hasBody && (
        <div className="relative rounded-2xl border bg-card p-4 shadow-card">
          <CopyButton text={JSON.stringify(response.body, null, 2)} className="absolute right-2 top-2" />
          <JsonTree value={response.body} />
        </div>
      )}
    </div>
  );
}
