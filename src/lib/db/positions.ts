export interface PositionedRow {
  id: string;
  position: number;
}

export interface InsertPlan {
  /** The `position` value the new row should be inserted with. */
  position: number;
  /** Existing rows that must have their `position` written to the given value first, to make room. */
  shifts: PositionedRow[];
}

/**
 * Works out where a new row should land among `existing` rows (already
 * ordered by `position`, then `id`) so that it sits immediately before
 * `beforeId` - or at the end, when `beforeId` is null or no longer present.
 *
 * Mirrors `insertBefore` from `src/lib/arrays.ts`, but for integer `position`
 * columns rather than array order: instead of splicing, it reports which
 * existing rows need their position bumped by one to open a gap.
 */
export function planInsert(existing: PositionedRow[], beforeId: string | null): InsertPlan {
  const index = beforeId ? existing.findIndex((row) => row.id === beforeId) : -1;
  if (index < 0) {
    const position = existing.length ? existing[existing.length - 1].position + 1 : 0;
    return { position, shifts: [] };
  }
  const position = existing[index].position;
  const shifts = existing.slice(index).map((row) => ({ id: row.id, position: row.position + 1 }));
  return { position, shifts };
}
