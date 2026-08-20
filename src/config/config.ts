import fs from "node:fs";
import { z } from "zod";
import { PILOT_CONFIG_PATH, PILOT_HOME, SUPPORTED_PROVIDERS } from "../core/constants.js";
import { ConfigError } from "../core/errors.js";
import { defaultConfig, type PilotConfig } from "./defaults.js";

const ConfigSchema = z.object({
  provider: z.enum(SUPPORTED_PROVIDERS),
  model: z.string().min(1),
  autoApproveSafe: z.boolean(),
  workspaceRoot: z.string().min(1),
  ollamaHost: z.string().url(),
});

let cached: PilotConfig | null = null;

function ensureHome(): void {
  if (!fs.existsSync(PILOT_HOME)) {
    fs.mkdirSync(PILOT_HOME, { recursive: true, mode: 0o700 });
  }
}

export function loadConfig(): PilotConfig {
  if (cached) return cached;
  ensureHome();
  if (!fs.existsSync(PILOT_CONFIG_PATH)) {
    const config = defaultConfig();
    saveConfig(config);
    return config;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(PILOT_CONFIG_PATH, "utf-8"));
    const parsed = ConfigSchema.parse(raw);
    cached = parsed;
    return parsed;
  } catch (err) {
    throw new ConfigError(
      `Config file at ${PILOT_CONFIG_PATH} is invalid: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
}

export function saveConfig(config: PilotConfig): void {
  ensureHome();
  const parsed = ConfigSchema.parse(config);
  fs.writeFileSync(PILOT_CONFIG_PATH, JSON.stringify(parsed, null, 2), {
    mode: 0o600,
  });
  cached = parsed;
}

export function updateConfig(partial: Partial<PilotConfig>): PilotConfig {
  const current = loadConfig();
  const next = { ...current, ...partial };
  saveConfig(next);
  return next;
}
