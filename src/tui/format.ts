export function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

/** Runs a possibly-throwing accessor (e.g. a fresh SQLite read) and falls
 * back to a default instead of crashing the whole TUI render. */
export function safeCall<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}
