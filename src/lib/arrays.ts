export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const next = items.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** Insert `item` just before the entry with `beforeId`, or at the end if that entry is gone. */
export function insertBefore<T extends { id: string }>(items: T[], item: T, beforeId: string | null): T[] {
  const next = items.filter((i) => i.id !== item.id);
  const index = beforeId ? next.findIndex((i) => i.id === beforeId) : -1;
  next.splice(index < 0 ? next.length : index, 0, item);
  return next;
}
