import { ProviderError } from "../core/errors.js";
import type {
  ChatMessage,
  CompletionRequest,
  CompletionResult,
  ModelProvider,
  ToolCallRequest,
} from "./provider.js";

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";

export class AnthropicProvider implements ModelProvider {
  readonly id = "anthropic";

  async complete(
    request: CompletionRequest,
    apiKey: string | undefined
  ): Promise<CompletionResult> {
    if (!apiKey) {
      throw new ProviderError(
        'No Anthropic API key configured. Run "pilot config keys set anthropic".'
      );
    }

    const system = request.messages.find((m) => m.role === "system")?.content;
    const messages = toAnthropicMessages(
      request.messages.filter((m) => m.role !== "system")
    );

    const body = {
      model: request.model,
      max_tokens: request.maxTokens ?? 4096,
      system,
      messages,
      tools: request.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      })),
    };

    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": API_VERSION,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new ProviderError(`Anthropic API error (${res.status}): ${trim(text)}`);
    }

    const data = (await res.json()) as AnthropicResponse;
    return parseAnthropicResponse(data);
  }
}

function toAnthropicMessages(messages: ChatMessage[]) {
  return messages.map((m) => {
    if (m.role === "tool") {
      return {
        role: "user" as const,
        content: [
          {
            type: "tool_result",
            tool_use_id: m.toolCallId,
            content: m.content,
          },
        ],
      };
    }
    return { role: m.role, content: m.content };
  });
}

interface AnthropicContentBlock {
  type: "text" | "tool_use";
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

interface AnthropicResponse {
  content: AnthropicContentBlock[];
  stop_reason: string;
}

function parseAnthropicResponse(data: AnthropicResponse): CompletionResult {
  let text = "";
  const toolCalls: ToolCallRequest[] = [];

  for (const block of data.content ?? []) {
    if (block.type === "text" && block.text) text += block.text;
    if (block.type === "tool_use" && block.id && block.name) {
      toolCalls.push({ id: block.id, name: block.name, arguments: block.input ?? {} });
    }
  }

  return {
    text,
    toolCalls,
    stopReason: data.stop_reason === "tool_use" ? "tool_use" : "end_turn",
  };
}

function trim(text: string): string {
  return text.length > 500 ? text.slice(0, 500) + "…" : text;
}
