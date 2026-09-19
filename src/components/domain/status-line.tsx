const STATUS_TEXT: Record<number, string> = { 200: "OK", 201: "Created", 204: "No Content", 400: "Bad Request", 404: "Not Found", 500: "Server Error" };

interface Props { status: number; durationMs?: number; tone?: "light" | "slate"; contentType?: string }

export function statusText(status: number) { return STATUS_TEXT[status] ?? ""; }

export function StatusLine({ status, durationMs, tone = "light", contentType = "application/json" }: Props) {
  const slate = tone === "slate";
  const colour = status < 300 ? (slate ? "text-method-get-on-slate" : "text-success") : status < 500 ? (slate ? "text-method-put-on-slate" : "text-warning") : slate ? "text-method-delete-on-slate" : "text-danger";
  return (
    <p className={`flex flex-wrap items-center gap-2 font-mono text-xs ${slate ? "text-slate-muted" : "text-ink-3"}`}>
      <span className={`font-semibold ${colour}`}>{status} {statusText(status)}</span>
      {durationMs !== undefined && <><span aria-hidden>·</span><span>{durationMs}ms</span></>}
      {status !== 204 && <><span aria-hidden>·</span><span>{contentType}</span></>}
    </p>
  );
}
