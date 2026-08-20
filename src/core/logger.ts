import fs from "node:fs";
import path from "node:path";
import { PILOT_HOME } from "./constants.js";
import { redact } from "../security/redaction.js";

export type LogLevel = "debug" | "info" | "warn" | "error";

class Logger {
  private logFile: string;

  constructor() {
    if (!fs.existsSync(PILOT_HOME)) {
      fs.mkdirSync(PILOT_HOME, { recursive: true, mode: 0o700 });
    }
    this.logFile = path.join(PILOT_HOME, "pilot.log");
  }

  private write(level: LogLevel, message: string, meta?: unknown): void {
    const safeMessage = redact(message);
    const safeMeta = meta !== undefined ? redact(safeStringify(meta)) : undefined;
    const line = `[${new Date().toISOString()}] ${level.toUpperCase()} ${safeMessage}${
      safeMeta ? " " + safeMeta : ""
    }\n`;
    try {
      fs.appendFileSync(this.logFile, line, { mode: 0o600 });
    } catch {
      // Logging must never crash the agent.
    }
  }

  debug(message: string, meta?: unknown): void {
    this.write("debug", message, meta);
  }

  info(message: string, meta?: unknown): void {
    this.write("info", message, meta);
  }

  warn(message: string, meta?: unknown): void {
    this.write("warn", message, meta);
  }

  error(message: string, meta?: unknown): void {
    this.write("error", message, meta);
  }
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export const logger = new Logger();
