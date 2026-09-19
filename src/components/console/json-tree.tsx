export type JsonTone = "light" | "slate";

interface Props {
  value: unknown;
  name?: string;
  depth?: number;
  tone?: JsonTone;
}

interface Palette {
  key: string;
  string: string;
  number: string;
  boolean: string;
  muted: string;
  guide: string;
}

const LIGHT: Palette = {
  key: "text-syntax-key",
  string: "text-syntax-string",
  number: "text-syntax-number",
  boolean: "text-syntax-boolean",
  muted: "text-syntax-muted",
  guide: "border-line",
};

const SLATE: Palette = {
  key: "text-syntax-key-slate",
  string: "text-syntax-string-slate",
  number: "text-syntax-number-slate",
  boolean: "text-syntax-boolean-slate",
  muted: "text-syntax-muted-slate",
  guide: "border-slate-2",
};

function valueClass(value: unknown, palette: Palette): string {
  if (typeof value === "string") return palette.string;
  if (typeof value === "number") return palette.number;
  if (typeof value === "boolean") return palette.boolean;
  return palette.muted;
}

export function JsonTree({ value, name, depth = 0, tone = "light" }: Props) {
  const palette = tone === "slate" ? SLATE : LIGHT;
  const label = name !== undefined ? <span className={palette.key}>{JSON.stringify(name)}: </span> : null;

  if (value !== null && typeof value === "object") {
    const isArray = Array.isArray(value);
    const entries = isArray ? value.map((v, i) => [String(i), v] as const) : Object.entries(value);
    return (
      <details open={depth < 3} className="font-mono text-xs">
        <summary className="cursor-pointer select-none">
          {label}
          <span className={palette.muted}>
            {isArray ? "[" : "{"} <span className="italic">{entries.length} {isArray ? "items" : "keys"}</span>
          </span>
        </summary>
        <div className={`ml-4 border-l pl-3 ${palette.guide}`}>
          {entries.map(([k, v]) => (
            <JsonTree key={k} name={isArray ? undefined : k} value={v} depth={depth + 1} tone={tone} />
          ))}
        </div>
        <span className={palette.muted}>{isArray ? "]" : "}"}</span>
      </details>
    );
  }

  return (
    <div className="font-mono text-xs">
      {label}
      <span className={valueClass(value, palette)}>{JSON.stringify(value)}</span>
    </div>
  );
}
