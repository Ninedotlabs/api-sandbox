interface PgErrorLike {
  code?: string;
}

function pgErrorCode(error: unknown): string | undefined {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as PgErrorLike).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

/**
 * Turns a raw `pg` driver error into a plain-language one where we recognise
 * the Postgres error code, and otherwise falls back to `fallback` rather than
 * leaking a driver-shaped message.
 */
export function friendlyDbError(error: unknown, fallback: string): Error {
  const code = pgErrorCode(error);
  if (code === "23505") return new Error("Something with this name or address already exists.");
  if (code === "23503") return new Error("That refers to something that doesn't exist.");
  if (error instanceof Error) return error;
  return new Error(fallback);
}
