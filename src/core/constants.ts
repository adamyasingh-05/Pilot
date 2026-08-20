import os from "node:os";
import path from "node:path";

export const PILOT_VERSION = "0.1.0";

export const PILOT_HOME = path.join(os.homedir(), ".pilot");
export const PILOT_CONFIG_PATH = path.join(PILOT_HOME, "config.json");
export const PILOT_DB_PATH = path.join(PILOT_HOME, "memory.sqlite");
export const PILOT_AUDIT_LOG_PATH = path.join(PILOT_HOME, "audit.log");
export const PILOT_KEYS_DIR = path.join(PILOT_HOME, "keys");

export const SUPPORTED_PROVIDERS = [
  "ollama",
  "openai",
  "anthropic",
  "openrouter",
  "gemini",
] as const;

export type ProviderId = (typeof SUPPORTED_PROVIDERS)[number];

export const DEFAULT_PROVIDER: ProviderId = "ollama";

export const DANGEROUS_COMMAND_PATTERNS: RegExp[] = [
  /\brm\s+-rf\s+\/(?!\S)/, // rm -rf /
  /\bmkfs\b/,
  /\bdd\s+if=/,
  /:\(\)\s*\{\s*:\|:&\s*\};/, // fork bomb
  /\bshutdown\b/,
  /\breboot\b/,
  /\bsudo\s+rm\b/,
  /\bchmod\s+-R\s+777\s+\//,
];

export const MAX_AGENT_STEPS = 40;
