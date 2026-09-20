"use client";

import { AlertTriangle, Check, Copy, KeyRound, Plus, RotateCw, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { ApiTokenSummary } from "@/lib/auth/api-token";

interface CreatedToken {
  token: string;
  summary: ApiTokenSummary;
}

interface Envelope<T> {
  data?: T;
  error?: string;
}

async function payload<T>(response: Response): Promise<T> {
  const body = (await response.json()) as Envelope<T>;
  if (!response.ok || body.data === undefined) throw new Error(body.error ?? "Something went wrong. Please try again.");
  return body.data;
}

function formatDate(value: string | null): string {
  if (!value) return "Never used";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function TokenPanel() {
  const [tokens, setTokens] = useState<ApiTokenSummary[] | null>(null);
  const [name, setName] = useState("My MCP client");
  const [created, setCreated] = useState<CreatedToken | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    void fetch("/api/mcp/token")
      .then((response) => payload<ApiTokenSummary[]>(response))
      .then((value) => {
        if (active) {
          setTokens(value);
          setLoadError(null);
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        const message = error instanceof Error ? error.message : "Could not load tokens.";
        setTokens([]);
        setLoadError(message);
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  async function generate() {
    setBusy(true);
    try {
      const result = await payload<CreatedToken>(
        await fetch("/api/mcp/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        }),
      );
      setCreated(result);
      setTokens((current) => [result.summary, ...(current ?? [])]);
      toast.success("Personal MCP token created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create a token.");
    } finally {
      setBusy(false);
    }
  }

  async function copySecret() {
    if (!created) return;
    await navigator.clipboard.writeText(created.token);
    setCopied(true);
    toast.success("Token copied");
    window.setTimeout(() => setCopied(false), 1500);
  }

  async function revoke(token: ApiTokenSummary) {
    if (!window.confirm(`Revoke “${token.name}”? Clients using it will stop working immediately.`)) return;
    try {
      await payload<{ id: string }>(await fetch(`/api/mcp/token/${encodeURIComponent(token.id)}`, { method: "DELETE" }));
      setTokens((current) => current?.filter((item) => item.id !== token.id) ?? []);
      if (created?.summary.id === token.id) setCreated(null);
      toast.success("Token revoked");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not revoke the token.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-ink">Token name</span>
          <Input value={name} maxLength={40} onChange={(event) => setName(event.target.value)} placeholder="Claude Desktop" />
        </label>
        <Button onClick={() => void generate()} disabled={busy || !name.trim()}>
          <Plus aria-hidden /> {busy ? "Generating…" : "Generate token"}
        </Button>
      </div>

      {created && (
        <div role="status" className="space-y-3 rounded-xl border border-success/40 bg-success/5 p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
            <div>
              <p className="font-medium text-ink">Copy this token now</p>
              <p className="text-sm text-ink-3">For security, the complete value is shown only once. We store only its hash.</p>
            </div>
          </div>
          <div className="flex min-w-0 items-center gap-2 rounded-lg border border-line bg-slate p-2 text-slate-ink">
            <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap px-1 font-mono text-xs">{created.token}</code>
            <Button variant="secondary" size="sm" onClick={() => void copySecret()}>
              {copied ? <Check aria-hidden /> : <Copy aria-hidden />} {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      )}

      {loadError && (
        <div role="alert" className="flex items-center gap-3 rounded-xl border border-danger/35 bg-danger/5 p-3 text-sm text-danger">
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">{loadError}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setTokens(null);
              setLoadError(null);
              setReloadKey((value) => value + 1);
            }}
          >
            <RotateCw aria-hidden /> Retry
          </Button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <KeyRound className="size-4 text-accent" aria-hidden />
          <h3 className="font-medium text-ink">Your active tokens</h3>
        </div>
        {tokens === null ? (
          <div className="space-y-3 p-4" aria-label="Loading tokens">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : tokens.length === 0 ? (
          <p className="p-5 text-sm text-ink-3">No tokens yet. Generate one for each MCP client you connect.</p>
        ) : (
          <ul className="divide-y divide-line">
            {tokens.map((token) => (
              <li key={token.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{token.name}</p>
                  <p className="mt-0.5 font-mono text-xs text-ink-3">{token.id} · {formatDate(token.lastUsedAt)}</p>
                </div>
                <Button variant="ghost" size="icon-sm" aria-label={`Revoke ${token.name}`} onClick={() => void revoke(token)}>
                  <Trash2 className="text-danger" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
