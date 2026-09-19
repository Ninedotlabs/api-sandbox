import { CopyButton } from "./copy-button";
import { tokenizeJson, type TokenKind } from "@/lib/json-highlight";
import { cn } from "@/lib/utils";

interface Props { code: string; language?: "json" | "http" | "text"; tone?: "light" | "slate"; title?: string; className?: string }

const LIGHT: Record<TokenKind, string> = { key: "text-syntax-key", string: "text-syntax-string", number: "text-syntax-number", boolean: "text-syntax-boolean", null: "text-syntax-muted", punct: "text-syntax-muted" };
const SLATE: Record<TokenKind, string> = { key: "text-syntax-key-slate", string: "text-syntax-string-slate", number: "text-syntax-number-slate", boolean: "text-syntax-boolean-slate", null: "text-syntax-muted-slate", punct: "text-syntax-muted-slate" };
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

function Http({ code, slate }: { code: string; slate: boolean }) {
  return (
    <>
      {code.split("\n").map((line, i) => {
        const [first, ...rest] = line.split(" ");
        if (METHODS.includes(first)) {
          const cls = `text-method-${first.toLowerCase()}${slate ? "-on-slate" : ""} font-semibold`;
          return (<span key={i} className="block"><span className={cls}>{first}</span> {rest.join(" ")}</span>);
        }
        return <span key={i} className="block">{line}</span>;
      })}
    </>
  );
}

export function CodePanel({ code, language = "json", tone = "light", title, className }: Props) {
  const slate = tone === "slate";
  const map = slate ? SLATE : LIGHT;
  return (
    <div className={cn("overflow-hidden rounded-lg border", slate ? "border-slate-2 bg-slate text-slate-ink" : "border-line bg-panel text-ink", className)}>
      <div className={cn("flex items-center justify-between border-b px-3 py-1.5", slate ? "border-slate-2 bg-slate-2" : "border-line bg-panel-strong/60")}>
        <span className={cn("kicker", slate && "text-slate-muted")}>{title ?? language.toUpperCase()}</span>
        <CopyButton text={code} className={cn("size-6", slate && "text-slate-muted hover:text-slate-ink")} />
      </div>
      <pre className="max-h-[480px] overflow-auto px-3 py-2.5 font-mono text-[13px] leading-relaxed">
        <code>
          {language === "json" ? tokenizeJson(code).map((t, i) => <span key={i} className={map[t.kind]}>{t.text}</span>) : language === "http" ? <Http code={code} slate={slate} /> : code}
        </code>
      </pre>
    </div>
  );
}
