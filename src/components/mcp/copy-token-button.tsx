"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TOKEN_ENDPOINT = "/api/mcp/token";

/**
 * Copies the real `UNIVERSAL_API_TOKEN` to the clipboard without ever putting it in the DOM
 * or in React state that could render - it fetches the value from `TOKEN_ENDPOINT` inside the
 * click handler and hands it straight to `navigator.clipboard.writeText`, discarding it
 * immediately after. `token-panel.tsx` (the server component this renders inside) only ever
 * sees and passes down the masked form; this is the one deliberate path to the full value.
 */
export function CopyTokenButton({ className }: { className?: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  async function copy() {
    let token: string | undefined;
    try {
      const res = await fetch(TOKEN_ENDPOINT);
      const payload = (await res.json().catch(() => undefined)) as { data?: { token?: string }; error?: string } | undefined;
      if (!res.ok || !payload?.data?.token) throw new Error(payload?.error ?? "Could not fetch the token.");
      token = payload.data.token;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not fetch the token.");
      return;
    }

    try {
      await navigator.clipboard.writeText(token);
    } catch {
      toast.error("Could not copy.");
      return;
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Button type="button" variant="ghost" size="icon" onClick={copy} aria-label={copied ? "Copied" : "Copy token"} className={cn("size-7", className)}>
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </Button>
  );
}
