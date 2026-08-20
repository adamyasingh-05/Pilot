/**
 * Redaction is the last line of defense. Every surface that can leak text
 * to the terminal, a log file, an error report, or a model prompt MUST
 * pass through `redact()` first. This module has no dependency on the
 * credential store's in-memory values by design — it works purely on
 * shape/pattern matching so it still catches keys that leaked into
 * variables it doesn't know about (e.g. copied into a shell command).
 */

interface SecretPattern {
  name: string;
  pattern: RegExp;
}

// Common API key shapes across major providers + generic high-entropy
// secrets. Deliberately broad — false positives (over-redaction) are
// always preferred over a leaked credential.
const SECRET_PATTERNS: SecretPattern[] = [
  { name: "openai", pattern: /\bsk-[A-Za-z0-9_-]{16,}\b/g },
  { name: "anthropic", pattern: /\bsk-ant-[A-Za-z0-9_-]{16,}\b/g },
  { name: "openrouter", pattern: /\bsk-or-[A-Za-z0-9_-]{16,}\b/g },
  { name: "gemini", pattern: /\bAIza[A-Za-z0-9_-]{20,}\b/g },
  { name: "generic-bearer", pattern: /\bBearer\s+[A-Za-z0-9._-]{20,}\b/gi },
  { name: "aws-access-key", pattern: /\bAKIA[0-9A-Z]{16}\b/g },
  {
    name: "generic-hex-secret",
    pattern: /\b[a-fA-F0-9]{32,64}\b/g,
  },
  {
    name: "env-assignment",
    pattern: /\b([A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD)[A-Z0-9_]*)\s*=\s*['"]?[^\s'"]{6,}['"]?/gi,
  },
];

export function redact(input: string): string {
  if (!input) return input;
  let result = input;
  for (const { pattern } of SECRET_PATTERNS) {
    result = result.replace(pattern, (match) => maskMatch(match));
  }
  return result;
}

function maskMatch(match: string): string {
  // Preserve env-assignment key names, mask only the value portion.
  const eq = match.indexOf("=");
  if (eq > -1 && /KEY|TOKEN|SECRET|PASSWORD/i.test(match.slice(0, eq))) {
    return `${match.slice(0, eq + 1)} [REDACTED]`;
  }
  if (match.length <= 8) return "[REDACTED]";
  return `${match.slice(0, 4)}…[REDACTED]…${match.slice(-2)}`;
}

/** Redacts every string value in an arbitrary JSON-like object, recursively. */
export function redactDeep<T>(value: T): T {
  if (typeof value === "string") {
    return redact(value) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => redactDeep(v)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = redactDeep(v);
    }
    return out as unknown as T;
  }
  return value;
}
