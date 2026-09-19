import type { LucideIcon } from "lucide-react";

interface Props {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-[1.5px] border-dashed border-sketch px-6 py-16 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-pastel-blue text-pastel-blue-ink">
        <Icon className="size-6" />
      </div>
      <h3 className="font-script text-2xl">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
