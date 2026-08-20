import { ProviderError } from "../core/errors.js";
import type {
  ChatMessage,
  CompletionRequest,
  CompletionResult,
  ModelProvider,
  ToolCallRequest,
} from "./provider.js";

const API_URL = "https://api.openai.com/v1/chat/completions";

export class OpenAIProvider implements ModelProvider {
  readonly id = "openai";

  async complete(
    request: CompletionRequest,
    apiKey: string | undefined
  ): Promise<CompletionResult> {
    if (!apiKey) {
      throw new ProviderError(
        'No OpenAI API key configured. Run "pilot config keys set openai".'
      );
    }

    const body = {
      model: request.model,
      messages: toOpenAIMessages(request.messages),
      tools: request.tools.map((t) => ({
        type: "function",
        function: { name: t.name, description: t.description, parameters: t.parameters },
      })),
      max_tokens: request.maxTokens ?? 4096,
    };

    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new ProviderError(`OpenAI API error (${res.status}): ${trim(text)}`);
    }

    const data = (await res.json()) as OpenAIResponse;
    return parseOpenAIResponse(data);
  }
}

function toOpenAIMessages(messages: ChatMessage[]) {
  return messages.map((m) => {
    if (m.role === "tool") {
      return { role: "tool" as const, tool_call_id: m.toolCallId, content: m.content };
    }
    return { role: m.role, content: m.content };
  });
}

interface OpenAIToolCall {
  id: string;
  function: { name: string; arguments: string };
}

interface OpenAIResponse {
  choices: Array<{
    message: { content: string | null; tool_calls?: OpenAIToolCall[] };
    finish_reason: string;
  }>;
}

function parseOpenAIResponse(data: OpenAIResponse): CompletionResult {
  const choice = data.choices?.[0];
  const text = choice?.message?.content ?? "";
  const toolCalls: ToolCallRequest[] = (choice?.message?.tool_calls ?? []).map((tc) => ({
    id: tc.id,
    name: tc.function.name,
    arguments: safeParseJson(tc.function.arguments),
  }));

  return {
    text,
    toolCalls,
    stopReason: toolCalls.length > 0 ? "tool_use" : "end_turn",
  };
}

function safeParseJson(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function trim(text: string): string {
  return text.length > 500 ? text.slice(0, 500) + "…" : text;
}
