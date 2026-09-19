import { Kicker } from "@/components/domain/kicker";

interface Props {
  kicker: string;
  /** Plain text or a node — an `InlineEdit` for renameable things. */
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}

/** The band at the top of the editor: what is selected, and what can be done to it. */
export function EditorHeader({ kicker, title, description, actions }: Props) {
  return (
    <header className="flex flex-wrap items-start gap-x-4 gap-y-3 border-b border-line px-6 py-4">
      <div className="min-w-0 flex-1">
        <Kicker>{kicker}</Kicker>
        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2 text-lg font-semibold text-ink">{title}</div>
        {description && <div className="mt-1 text-[13px] text-ink-2">{description}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
