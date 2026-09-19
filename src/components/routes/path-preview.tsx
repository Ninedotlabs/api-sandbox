export function PathPreview({ base, path }: { base: string; path: string }) {
  return (
    <code className="font-mono">
      {base}
      {path.split(/(\/)/).map((part, i) =>
        part.startsWith(":") ? (
          <span key={i} className="rounded bg-primary/15 px-0.5 text-primary">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </code>
  );
}
