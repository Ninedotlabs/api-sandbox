import { tokenizeJson, type TokenKind } from "@/lib/json-highlight";
import { cn } from "@/lib/utils";
import { CopyButton } from "./copy-button";

const TOKEN_CLASS: Record<TokenKind, string> = {
  key: "text-primary",
  string: "text-success",
  number: "text-warning",
  boolean: "text-pastel-lavender-ink",
  null: "text-muted-foreground",
  punct: "text-muted-foreground",
};

interface Props {
  code: string;
  language?: "json" | "text";
  className?: string;
}

export function CodeBlock({ code, language = "json", className }: Props) {
  return (
    <div className={cn("relative rounded-2xl border bg-soft", className)}>
      <CopyButton text={code} className="absolute right-2 top-2" />
      <pre className="max-h-[480px] overflow-auto p-4 pr-12 font-mono text-xs leading-relaxed">
        <code>
          {language === "json"
            ? tokenizeJson(code).map((t, i) => (
                <span key={i} className={TOKEN_CLASS[t.kind]}>
                  {t.text}
                </span>
              ))
            : code}
        </code>
      </pre>
    </div>
  );
}
