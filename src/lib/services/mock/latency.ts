let latencyMs = 200;

export function setMockLatency(ms: number) {
  latencyMs = ms;
}

/** Resolves with a deep copy after the fake network delay, so callers can't mutate stored data. */
export function delay<T>(value: T): Promise<T> {
  const copy = value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
  return new Promise((resolve) => setTimeout(() => resolve(copy), latencyMs));
}
