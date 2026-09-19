"use client";

import { cn } from "@/lib/utils";

interface Props extends Omit<React.ComponentProps<"div">, "ref" | "children" | "onSelect"> {
  /** The accessible name of the row; the visible content stays free to be decorative. */
  label: string;
  level: 1 | 2;
  posInSet: number;
  setSize: number;
  selected: boolean;
  /** Only the node under the roving tabindex is reachable with Tab. */
  active: boolean;
  expanded?: boolean;
  onSelect: () => void;
  ref?: React.Ref<HTMLDivElement>;
  children: React.ReactNode;
}

/** One row of the API tree: a flat `treeitem` that carries its own level and position. */
export function TreeNode({ label, level, posInSet, setSize, selected, active, expanded, onSelect, ref, children, ...rest }: Props) {
  return (
    <div
      {...rest}
      ref={ref}
      role="treeitem"
      aria-label={label}
      aria-level={level}
      aria-posinset={posInSet}
      aria-setsize={setSize}
      aria-selected={selected}
      aria-expanded={expanded}
      tabIndex={active ? 0 : -1}
      onClick={onSelect}
      className={cn(
        "flex h-7 cursor-pointer items-center gap-1.5 border-l-2 pr-2 text-[13px] transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset focus-visible:outline-none",
        level === 1 ? "pl-2" : "pl-5",
        selected ? "border-accent bg-accent-soft text-accent-ink" : "border-transparent text-ink-2 hover:bg-panel-strong/60",
      )}
    >
      {children}
    </div>
  );
}
