import { ProviderError } from "../core/errors.js";
import type {
  ChatMessage,
  CompletionRequest,
  CompletionResult,
  ModelProvider,
  ToolCallRequest,
} from "./provider.js";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export class GeminiProvider implements ModelProvider {
  readonly id = "gemini";

  async complete(
    request: CompletionRequest,
    apiKey: string | undefined
  ): Promise<CompletionResult> {
    if (!apiKey) {
      throw new ProviderError(
        'No Gemini API key configured. Run "pilot config keys set gemini".'
      );
    }

    const system = request.messages.find((m) => m.role === "system")?.content;
    const contents = toGeminiContents(request.messages.filter((m) => m.role !== "system"));

    const body = {
      systemInstruction: system ? { parts: [{ text: system }] } : undefined,
      contents,
      tools:
        request.tools.length > 0
          ? [
              {
                functionDeclarations: request.tools.map((t) => ({
                  name: t.name,
                  description: t.description,
                  parameters: t.parameters,
                })),
              },
            ]
          : undefined,
    };

    const url = `${API_BASE}/${encodeURIComponent(request.model)}:generateContent?key=${encodeURIComponent(
      apiKey
    )}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new ProviderError(`Gemini API error (${res.status}): ${trim(text)}`);
    }

    const data = (await res.json()) as GeminiResponse;
    return parseGeminiResponse(data);
  }
}

function toGeminiContents(messages: ChatMessage[]) {
  return messages.map((m) => {
    if (m.role === "tool") {
      return {
        role: "function",
        parts: [{ functionResponse: { name: m.toolName, response: { content: m.content } } }],
      };
    }
    return {
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    };
  });
}

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args: Record<string, unknown> };
}

interface GeminiResponse {
  candidates?: Array<{ content: { parts: GeminiPart[] } }>;
}

function parseGeminiResponse(data: GeminiResponse): CompletionResult {
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  let text = "";
  const toolCalls: ToolCallRequest[] = [];
  let counter = 0;

  for (const part of parts) {
    if (part.text) text += part.text;
    if (part.functionCall) {
      toolCalls.push({
        id: `gemini-call-${counter++}`,
        name: part.functionCall.name,
        arguments: part.functionCall.args ?? {},
      });
    }
  }

  return { text, toolCalls, stopReason: toolCalls.length > 0 ? "tool_use" : "end_turn" };
}

function trim(text: string): string {
  return text.length > 500 ? text.slice(0, 500) + "…" : text;
}
