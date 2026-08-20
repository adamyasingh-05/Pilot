# Security model

Pilot's core promise: **it never intentionally exposes your API credentials**,
and it never touches your filesystem or runs a command without your say-so
when the action is risky.

## Credential handling

- Keys are entered once via `pilot config keys set <provider>` and encrypted
  at rest with AES-256-GCM under a machine-local key file
  (`~/.pilot/keys/.machine.key`, mode `0600`). See `src/security/credentials.ts`.
- Keys are decrypted into memory only for the duration of a single provider
  request and are passed directly into that provider's auth header. They are
  never interpolated into a prompt, never handed to a tool, and never written
  back to disk in plaintext.
- `pilot config keys list` and `pilot status` only ever print a masked
  preview (`sk-ant-...ab12`) plus a creation date — never the key itself.
- There is no Pilot-owned server. Nothing about your keys, prompts, or files
  is uploaded anywhere Pilot controls. Requests go straight from your machine
  to the provider you selected (or to your local Ollama instance).
- `terminal_exec` strips any environment variable that looks like a
  credential (`*_API_KEY`, `*_TOKEN`, `*_SECRET`) from the child process
  environment before running a command, so a shell command can't
  accidentally echo a key that happens to be exported in your shell.
- Every log line and audit entry passes through `src/security/redaction.ts`,
  which pattern-matches common API key shapes (OpenAI, Anthropic,
  OpenRouter, Gemini/Google, AWS, generic bearer tokens, generic hex
  secrets) and masks them before they ever hit disk.

## Filesystem safety

- All filesystem tools resolve paths through `src/security/paths.ts`, which
  rejects anything that escapes the current workspace root, and hard-denies
  a fixed list of sensitive system directories (`/etc`, `~/.ssh`,
  `~/.pilot/keys`, `~/.aws`, `~/.gnupg`, etc.) even if the user tries to
  approve it.
- `fs_delete` only ever removes single files, never directories.

## Browser safety

- `browser_open` refuses anything but `http://`/`https://` URLs — no `file://`, no
  `javascript:`, no `data:` — so the browser tools can't be used to read local files or
  execute arbitrary script URIs.
- `browser_click` and `browser_type` are classified `review`, since a click can submit a
  form or trigger a purchase; `browser_open` and `browser_extract_text` are `safe`
  (read-only navigation/inspection).
- `browser_screenshot` writes through the same `resolveSafePath` sandboxing as the
  filesystem tools, so it can't be pointed outside the workspace.
- The browser session (one Chromium instance, reused across the tool calls in a single
  task) is always closed at the end of a task — success, failure, or step-limit — so no
  browser process lingers between runs.

## Approval model

Every tool declares a risk level for a given call:

| Risk        | Behavior                                                        |
|-------------|-------------------------------------------------------------------|
| `safe`      | Runs immediately (reads, listings).                              |
| `review`    | Requires approval unless the user has approved that action type for the session, or is running with `--yes`. |
| `dangerous` | Always requires explicit approval — `--yes` does not bypass it.  |

Shell commands are additionally scanned against a list of known-destructive
patterns (`rm -rf /`, fork bombs, `mkfs`, force-pushes, etc.) in
`src/security/permissions.ts` and are always classified `dangerous`.

## Audit trail

Every tool invocation — approved or denied — is appended to
`~/.pilot/audit.log` (redacted, human-readable JSON lines) and to the local
SQLite task history (`~/.pilot/memory.sqlite`). Run `pilot audit` or
`pilot history` to review what Pilot has done.

## Reporting a vulnerability

Please open a private security advisory on the GitHub repository rather than
a public issue.
