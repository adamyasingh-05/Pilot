# Adding a provider

Every provider implements the small interface in `src/providers/provider.ts`:

```ts
export interface ModelProvider {
  readonly id: string;
  complete(request: CompletionRequest, apiKey: string | undefined): Promise<CompletionResult>;
}
```

`CompletionRequest` carries the full message history, the list of available
tool specs (JSON Schema), and the model name. Your `complete()` implementation
should:

1. Translate `request.messages` and `request.tools` into that provider's wire
   format (see `src/providers/anthropic.ts` or `src/providers/openai.ts` for
   examples of the two dominant shapes).
2. Make the HTTP call directly — no SDK dependency required, just `fetch`.
3. Parse the response back into `CompletionResult { text, toolCalls, stopReason }`.

Steps to wire it in:

1. Add the provider id to `SUPPORTED_PROVIDERS` in `src/core/constants.ts`.
2. Add a default model to `DEFAULT_MODELS` in `src/config/defaults.ts`.
3. Create `src/providers/<name>.ts` implementing `ModelProvider`.
4. Register an instance in `PROVIDER_INSTANCES` in `src/agent/context.ts`.

That's it — `pilot config provider <name>`, `pilot config keys set <name>`,
and the agent loop all pick it up automatically since they only ever go
through the `ModelProvider` interface and the shared credential store.

## Credential handling requirement

If your provider needs an API key, **never** read it from `process.env`
directly inside the provider file — `context.ts` resolves it from the local
encrypted credential store and passes it into `complete()` as the second
argument. This keeps the "keys never touch a log/prompt/tool" guarantee in
one place instead of re-implemented per provider.
