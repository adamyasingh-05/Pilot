# Architecture

```
cli/        Commander-based entry point + subcommands. Decides whether to
             launch the Ink TUI (interactive TTY) or the plain readline
             fallback (non-TTY / CI), or run a single task and exit.

tui/        Ink (React for terminals) components and screens. Purely a
             presentation layer over agent/loop.ts — it never talks to
             providers or tools directly. App.tsx routes the command
             palette (Ctrl+K) to one screen per command: HomeScreen,
             RunScreen, ProvidersScreen, CredentialsScreen,
             PermissionsScreen, SettingsScreen, DiagnosticsScreen,
             HistoryScreen, MemoryScreen — each reads/writes config,
             credentials, or memory directly (still never touching
             providers or tools) and calls back into App's config state
             so the header stays in sync.

agent/      The agentic core.
              - planner.ts  builds the system prompt + initial messages
              - context.ts  resolves provider + decrypts its credential
              - loop.ts     the plan → approve → execute → observe cycle
              - agent.ts    public facade; registers built-in tools

providers/  One file per model backend, all implementing the same
             ModelProvider interface (providers/provider.ts) so the agent
             loop is provider-agnostic. Ollama needs no key; the others
             receive a decrypted key at call time only.

tools/      Each tool module self-registers into tools/registry.ts with a
             JSON-schema spec (shown to the model), a risk classifier, a
             human-readable describe() for the approval prompt, and a
             run() implementation.

security/   Cross-cutting: path sandboxing, credential storage, secret
             redaction, the approval/permission gate, and the audit log.
             Every other layer depends on this one; it depends on nothing
             else in the project.

config/     Local, validated (zod) config at ~/.pilot/config.json.

memory/     SQLite-backed task history and simple key/value notes, local
             to ~/.pilot/memory.sqlite.
```

## The agent loop, in short

1. Build the initial message stack (system prompt + user's task).
2. Ask the configured provider for a completion, offering it every
   registered tool's spec.
3. If the model returns plain text with no tool calls, the task is done —
   summarize and stop.
4. If it returns tool calls, for each one:
   - classify risk,
   - request approval if `risk !== "safe"`,
   - run it if approved, appending the (redacted, truncated) result back
     into the message stack as a `tool` message,
   - record it in the audit log and task history either way.
5. Repeat from step 2, up to `MAX_AGENT_STEPS`, so the model can react to
   what it just observed before deciding on its next action.

## Adding a tool

Create a module under `src/tools/<category>/`, call
`toolRegistry.register({...})` with a spec/classifyRisk/describe/run, and
import it for its side effect from `src/agent/agent.ts`. No other file
needs to change — the planner, loop, and TUI all discover tools through the
registry.

## Adding a provider

See [`docs/providers.md`](providers.md).
