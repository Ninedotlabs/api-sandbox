import { CopyButton } from "@/components/domain/copy-button";
import { Kicker } from "@/components/domain/kicker";
import { StatusLine } from "@/components/domain/status-line";
import type { TestResponse } from "@/lib/types";
import { JsonTree } from "./json-tree";

/** One plain sentence per status, so a code is never the whole answer. */
const EXPLANATION: Record<number, string> = {
  200: "It worked.",
  201: "The record was saved.",
  204: "It worked. The record was deleted, so there's nothing to show.",
  400: "Something in the data you sent needs fixing.",
  404: "There's no record with that id.",
  500: "The mock server could not handle that request.",
};

/** The one dark element on the screen: what the mock server sent back. */
export function ResponsePanel({ response, loading }: { response: TestResponse | null; loading: boolean }) {
  const hasBody = response ? response.body !== null && response.body !== undefined : false;

  return (
    <section className="overflow-hidden rounded-lg border border-slate-2 bg-slate text-slate-ink">
      <div className="flex items-center justify-between gap-2 border-b border-slate-2 bg-slate-2 px-3 py-1.5">
        <Kicker className="text-slate-muted">Response</Kicker>
        {response && hasBody && (
          <CopyButton
            text={JSON.stringify(response.body, null, 2)}
            className="size-6 text-slate-muted hover:bg-slate hover:text-slate-ink"
          />
        )}
      </div>
      <div className="space-y-2 px-3 py-2.5" aria-live="polite" aria-busy={loading}>
        {loading ? (
          <p className="font-mono text-xs text-slate-muted">Waiting for the mock server…</p>
        ) : !response ? (
          <p className="text-[13px] text-slate-muted">{"Pick an endpoint, fill the request and send it."}</p>
        ) : (
          <>
            <StatusLine status={response.status} durationMs={response.durationMs} tone="slate" />
            {EXPLANATION[response.status] && <p className="text-[13px] text-slate-muted">{EXPLANATION[response.status]}</p>}
            {hasBody && (
              <div className="max-h-72 overflow-auto pt-1">
                <JsonTree value={response.body} tone="slate" />
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
