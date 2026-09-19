"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { baseUrl } from "@/lib/slug";

/**
 * The mock server between the request and the response: the host, the base URL and a
 * track the packet crosses while a request is in flight. When the request lands, a tick
 * fades out on its own — a CSS animation rather than a timer, so nothing ticks after unmount.
 */
export function MockStrip({ sending, slug }: { sending: boolean; slug: string }) {
  const [state, setState] = useState({ wasSending: sending, deliveries: 0 });
  if (state.wasSending !== sending) {
    setState((s) => ({ wasSending: sending, deliveries: sending ? s.deliveries : s.deliveries + 1 }));
  }

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-2 font-mono text-[11px] text-ink-3">
        <span>localhost:3000</span>
        <span aria-hidden>·</span>
        <span className="text-ink-2">{baseUrl(slug)}</span>
      </p>
      <div className="relative h-[2px] w-full rounded-full bg-line-strong" aria-hidden>
        {sending && <span className="animate-packet absolute top-[-2px] size-[6px] rounded-full bg-accent" />}
        {!sending && state.deliveries > 0 && (
          <Check key={state.deliveries} className="animate-delivered absolute top-[-6px] right-0 size-3.5 text-success" />
        )}
      </div>
      <p aria-live="polite" className="sr-only">
        {sending ? "Sending request to the mock server" : ""}
      </p>
    </div>
  );
}
