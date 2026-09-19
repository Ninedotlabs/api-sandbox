import { cn } from "@/lib/utils";

interface Props {
  emoji: string;
  name: string;
  description: string;
  selected?: boolean;
  onSelect: () => void;
}

export function TemplateCard({ emoji, name, description, selected = false, onSelect }: Props) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex w-full flex-col items-start gap-1 rounded-[10px] border bg-surface-2 p-4 text-left transition-colors duration-150 hover:border-primary/50",
        selected && "border-primary bg-primary/10",
      )}
    >
      <span className="text-2xl" aria-hidden>
        {emoji}
      </span>
      <span className="font-medium">{name}</span>
      <span className="text-sm text-muted-foreground">{description}</span>
    </button>
  );
}
