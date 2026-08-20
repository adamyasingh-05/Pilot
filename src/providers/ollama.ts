import { ProviderError } from "../core/errors.js";
import { loadConfig } from "../config/config.js";
import type {
  ChatMessage,
  CompletionRequest,
  CompletionResult,
  ModelProvider,
  ToolCallRequest,
} from "./provider.js";

/**
 * Ollama runs entirely on the user's machine. No API key, no network
 * egress beyond localhost by default — the strongest expression of
 * "your computer, your keys, your control."
 */
export class OllamaProvider implements ModelProvider {
  readonly id = "ollama";

  async complete(request: CompletionRequest): Promise<CompletionResult> {
    const host = loadConfig().ollamaHost;

    const body = {
      model: request.model,
      messages: toOllamaMessages(request.messages),
      tools:
        request.tools.length > 0
          ? request.tools.map((t) => ({
              type: "function",
              function: { name: t.name, description: t.description, parameters: t.parameters },
            }))
          : undefined,
      stream: false,
    };

    let res: Response;
    try {
      res = await fetch(`${host}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      throw new ProviderError(
        `Could not reach local Ollama server at ${host}. Is Ollama running? Try "ollama serve".`
      );
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new ProviderError(`Ollama error (${res.status}): ${trim(text)}`);
    }

    const data = (await res.json()) as OllamaResponse;
    return parseOllamaResponse(data);
  }
}

function toOllamaMessages(messages: ChatMessage[]) {
  return messages.map((m) => {
    if (m.role === "tool") {
      return { role: "tool" as const, content: m.content };
    }
    return { role: m.role, content: m.content };
  });
}

interface OllamaToolCall {
  function: { name: string; arguments: Record<string, unknown> };
}

interface OllamaResponse {
  message: { content: string; tool_calls?: OllamaToolCall[] };
  done: boolean;
}

function parseOllamaResponse(data: OllamaResponse): CompletionResult {
  const toolCalls: ToolCallRequest[] = (data.message.tool_calls ?? []).map((tc, i) => ({
    id: `ollama-call-${i}`,
    name: tc.function.name,
    arguments: tc.function.arguments,
  }));

  return {
    text: data.message.content ?? "",
    toolCalls,
    stopReason: toolCalls.length > 0 ? "tool_use" : "end_turn",
  };
}

function trim(text: string): string {
  return text.length > 500 ? text.slice(0, 500) + "…" : text;
}
