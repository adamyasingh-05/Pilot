import fs from "node:fs";
import { PILOT_AUDIT_LOG_PATH, PILOT_HOME } from "../core/constants.js";
import { redact } from "./redaction.js";

export interface AuditEntry {
  timestamp: string;
  action: string;
  detail: string;
  approved: boolean;
  risk: string;
}

/**
 * Append-only, human-readable audit trail of every action Pilot took or
 * attempted, so a user can always answer "what did Pilot just do to my
 * computer?" All text is redacted before it touches disk.
 */
export function recordAudit(entry: Omit<AuditEntry, "timestamp">): void {
  if (!fs.existsSync(PILOT_HOME)) {
    fs.mkdirSync(PILOT_HOME, { recursive: true, mode: 0o700 });
  }
  const full: AuditEntry = { timestamp: new Date().toISOString(), ...entry };
  const line = JSON.stringify({
    ...full,
    detail: redact(full.detail),
  });
  fs.appendFileSync(PILOT_AUDIT_LOG_PATH, line + "\n", { mode: 0o600 });
}

export function readRecentAudit(limit = 50): AuditEntry[] {
  if (!fs.existsSync(PILOT_AUDIT_LOG_PATH)) return [];
  const lines = fs
    .readFileSync(PILOT_AUDIT_LOG_PATH, "utf-8")
    .split("\n")
    .filter(Boolean);
  return lines
    .slice(-limit)
    .map((line) => JSON.parse(line) as AuditEntry)
    .reverse();
}
