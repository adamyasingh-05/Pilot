import chalk from "chalk";
import { loadConfig, saveConfig, updateConfig } from "../config/config.js";
import { DEFAULT_MODELS, defaultConfig } from "../config/defaults.js";
import {
  deleteCredential,
  hasCredential,
  listCredentialPreviews,
  setCredential,
} from "../security/credentials.js";
import { SUPPORTED_PROVIDERS, type ProviderId } from "../core/constants.js";
import { readRecentAudit } from "../security/audit.js";
import { getRecentTasks } from "../memory/memory.js";
import { runTask } from "../agent/agent.js";
import type { ApprovalDecision } from "../security/permissions.js";
import readline from "node:readline/promises";

export function cmdInit(): void {
  const config = defaultConfig();
  saveConfig(config);
  console.log(chalk.green("✓") + " Initialized Pilot config at ~/.pilot/config.json");
  console.log(`  Provider: ${chalk.cyan(config.provider)}`);
  console.log(`  Model:    ${chalk.cyan(config.model)}`);
  console.log(`\nRun ${chalk.bold("pilot doctor")} to verify everything is set up.`);
}

export function cmdStatus(): void {
  const config = loadConfig();
  console.log(chalk.bold("Pilot status"));
  console.log(`  Provider:   ${chalk.cyan(config.provider)}`);
  console.log(`  Model:      ${chalk.cyan(config.model)}`);
  console.log(`  Workspace:  ${config.workspaceRoot}`);
  console.log(`  Auto-approve safe actions: ${config.autoApproveSafe ? "on" : "off"}`);
  if (config.provider !== "ollama") {
    const has = hasCredential(config.provider);
    console.log(`  API key set: ${has ? chalk.green("yes") : chalk.red("no")}`);
  }
}

export async function cmdDoctor(): Promise<void> {
  const config = loadConfig();
  console.log(chalk.bold("Running diagnostics...\n"));

  console.log(`Node version: ${process.version}`);
  console.log(`Platform: ${process.platform}`);
  console.log(`Config provider: ${config.provider}`);

  if (config.provider === "ollama") {
    try {
      const res = await fetch(`${config.ollamaHost}/api/tags`);
      console.log(
        res.ok
          ? chalk.green(`✓ Ollama reachable at ${config.ollamaHost}`)
          : chalk.red(`✗ Ollama responded with status ${res.status}`)
      );
    } catch {
      console.log(chalk.red(`✗ Could not reach Ollama at ${config.ollamaHost}`));
      console.log(`  Start it with: ${chalk.bold("ollama serve")}`);
    }
  } else {
    console.log(
      hasCredential(config.provider)
        ? chalk.green(`✓ API key stored for ${config.provider}`)
        : chalk.red(`✗ No API key stored for ${config.provider}. Run: pilot config keys set ${config.provider}`)
    );
  }

  console.log(chalk.green("\n✓ Diagnostics complete"));
}

export function cmdConfigShow(): void {
  cmdStatus();
}

export function cmdConfigProvider(provider?: string): void {
  if (!provider) {
    console.log(`Available providers: ${SUPPORTED_PROVIDERS.join(", ")}`);
    return;
  }
  if (!SUPPORTED_PROVIDERS.includes(provider as ProviderId)) {
    console.log(chalk.red(`Unknown provider "${provider}". Options: ${SUPPORTED_PROVIDERS.join(", ")}`));
    return;
  }
  const providerId = provider as ProviderId;
  const config = updateConfig({ provider: providerId, model: DEFAULT_MODELS[providerId] });
  console.log(chalk.green("✓") + ` Provider set to ${config.provider} (model: ${config.model})`);
}

export function cmdConfigModel(model?: string): void {
  if (!model) {
    console.log(`Current model: ${loadConfig().model}`);
    return;
  }
  const config = updateConfig({ model });
  console.log(chalk.green("✓") + ` Model set to ${config.model}`);
}

export async function cmdConfigKeysSet(provider: string): Promise<void> {
  if (!SUPPORTED_PROVIDERS.includes(provider as ProviderId)) {
    console.log(chalk.red(`Unknown provider "${provider}". Options: ${SUPPORTED_PROVIDERS.join(", ")}`));
    return;
  }
  if (provider === "ollama") {
    console.log("Ollama runs locally and does not need an API key.");
    return;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  // Note: for a real TTY-masked password prompt, swap this for a proper
  // hidden-input library. Kept plain here to avoid adding a dependency
  // for a single prompt; the value is never echoed back or logged.
  const key = await rl.question(`Enter API key for ${provider} (input will not be stored in shell history if pasted): `);
  rl.close();

  setCredential(provider as ProviderId, key.trim());
  console.log(chalk.green("✓") + ` Stored key for ${provider} (encrypted locally at ~/.pilot/keys)`);
}

export function cmdConfigKeysList(): void {
  const previews = listCredentialPreviews();
  if (previews.length === 0) {
    console.log("No API keys stored yet.");
    return;
  }
  console.log(chalk.bold("Stored keys (masked):"));
  for (const p of previews) {
    console.log(`  ${p.provider.padEnd(12)} ${p.preview}   set ${p.createdAt}`);
  }
}

export function cmdConfigKeysDelete(provider: string): void {
  deleteCredential(provider as ProviderId);
  console.log(chalk.green("✓") + ` Removed stored key for ${provider}`);
}

export function cmdHistory(): void {
  const tasks = getRecentTasks(15);
  if (tasks.length === 0) {
    console.log("No tasks yet.");
    return;
  }
  for (const task of tasks) {
    const statusColor =
      task.status === "completed" ? chalk.green : task.status === "failed" ? chalk.red : chalk.yellow;
    console.log(`${statusColor(task.status.padEnd(9))} ${task.created_at}  ${task.prompt}`);
  }
}

export function cmdAudit(): void {
  const entries = readRecentAudit(30);
  if (entries.length === 0) {
    console.log("No audit entries yet.");
    return;
  }
  for (const entry of entries) {
    const mark = entry.approved ? chalk.green("✓") : chalk.red("✗");
    console.log(`${mark} [${entry.risk}] ${entry.timestamp}  ${entry.action}: ${entry.detail}`);
  }
}

/** Simple readline-based approval prompt used by the non-interactive CLI path. */
async function cliApprovalPrompter(request: {
  action: string;
  summary: string;
  risk: string;
}): Promise<ApprovalDecision> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(
    `\n${chalk.yellow("Approval needed")} [${request.risk}] ${request.summary}\n(y)es / (a)ll for this action / (n)o > `
  );
  rl.close();
  const normalized = answer.trim().toLowerCase();
  if (normalized === "a" || normalized === "all") return "approve_all";
  if (normalized === "y" || normalized === "yes") return "approve";
  return "deny";
}

export async function cmdRun(prompt: string, opts: { yes?: boolean }): Promise<void> {
  const config = loadConfig();
  console.log(chalk.bold(`\nPilot — ${prompt}\n`));

  const result = await runTask({
    prompt,
    autoApproveSafe: config.autoApproveSafe || opts.yes,
    approvalPrompter: cliApprovalPrompter,
    onEvent: (event) => {
      if (event.type === "tool_call") console.log(chalk.dim("→ ") + event.detail);
      if (event.type === "tool_result") console.log(chalk.dim("  ") + truncate(event.detail));
      if (event.type === "final") console.log("\n" + chalk.bold("Result: ") + event.detail);
    },
  });

  console.log(
    result.success
      ? chalk.green(`\n✓ Task completed in ${result.steps} step(s)`)
      : chalk.red(`\n✗ Task did not complete: ${result.summary}`)
  );
}

function truncate(text: string, max = 300): string {
  return text.length > max ? text.slice(0, max) + "…" : text;
}
