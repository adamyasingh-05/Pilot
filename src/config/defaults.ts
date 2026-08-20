import type { ProviderId } from "../core/constants.js";

export interface PilotConfig {
  provider: ProviderId;
  model: string;
  autoApproveSafe: boolean;
  workspaceRoot: string;
  ollamaHost: string;
}

export const DEFAULT_MODELS: Record<ProviderId, string> = {
  ollama: "llama3.1",
  openai: "gpt-4.1",
  anthropic: "claude-sonnet-4-6",
  openrouter: "anthropic/claude-sonnet-4-6",
  gemini: "gemini-2.0-flash",
};

export function defaultConfig(): PilotConfig {
  return {
    provider: "ollama",
    model: DEFAULT_MODELS.ollama,
    autoApproveSafe: true,
    workspaceRoot: process.cwd(),
    ollamaHost: "http://127.0.0.1:11434",
  };
}
