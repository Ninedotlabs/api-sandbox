interface Props {
  value: unknown;
  name?: string;
  depth?: number;
}

function valueClass(value: unknown): string {
  if (typeof value === "string") return "text-success";
  if (typeof value === "number") return "text-warning";
  if (typeof value === "boolean") return "text-syntax-boolean";
  return "text-muted-foreground";
}

export function JsonTree({ value, name, depth = 0 }: Props) {
  const label = name !== undefined ? <span className="text-primary">{JSON.stringify(name)}: </span> : null;

  if (value !== null && typeof value === "object") {
    const isArray = Array.isArray(value);
    const entries = isArray ? value.map((v, i) => [String(i), v] as const) : Object.entries(value);
    return (
      <details open={depth < 3} className="font-mono text-xs">
        <summary className="cursor-pointer select-none hover:text-foreground">
          {label}
          <span className="text-muted-foreground">
            {isArray ? "[" : "{"} <span className="italic">{entries.length} {isArray ? "items" : "keys"}</span>
          </span>
        </summary>
        <div className="ml-4 border-l pl-3">
          {entries.map(([k, v]) => (
            <JsonTree key={k} name={isArray ? undefined : k} value={v} depth={depth + 1} />
          ))}
        </div>
        <span className="text-muted-foreground">{isArray ? "]" : "}"}</span>
      </details>
    );
  }

  return (
    <div className="font-mono text-xs">
      {label}
      <span className={valueClass(value)}>{JSON.stringify(value)}</span>
    </div>
  );
}
