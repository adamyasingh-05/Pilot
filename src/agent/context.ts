import { loadConfig } from "../config/config.js";
import { getCredential } from "../security/credentials.js";
import type { ModelProvider } from "../providers/provider.js";
import { OllamaProvider } from "../providers/ollama.js";
import { OpenAIProvider } from "../providers/openai.js";
import { AnthropicProvider } from "../providers/anthropic.js";
import { OpenRouterProvider } from "../providers/openrouter.js";
import { GeminiProvider } from "../providers/gemini.js";
import type { ProviderId } from "../core/constants.js";

const PROVIDER_INSTANCES: Record<ProviderId, ModelProvider> = {
  ollama: new OllamaProvider(),
  openai: new OpenAIProvider(),
  anthropic: new AnthropicProvider(),
  openrouter: new OpenRouterProvider(),
  gemini: new GeminiProvider(),
};

export interface AgentContext {
  provider: ModelProvider;
  apiKey: string | undefined;
  model: string;
  workspaceRoot: string;
}

/**
 * Resolves the active provider + decrypts its credential (if any) into
 * memory for this run only. The decrypted key lives only in this
 * object, is passed directly to the provider's fetch call, and is
 * never logged, printed, or persisted anywhere else.
 */
export function buildAgentContext(): AgentContext {
  const config = loadConfig();
  const provider = PROVIDER_INSTANCES[config.provider];
  const apiKey = config.provider === "ollama" ? undefined : getCredential(config.provider);

  return {
    provider,
    apiKey,
    model: config.model,
    workspaceRoot: config.workspaceRoot,
  };
}
