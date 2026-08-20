#!/usr/bin/env node
import { Command } from "commander";
import React from "react";
import { render } from "ink";
import dotenv from "dotenv";
import { PILOT_VERSION } from "../core/constants.js";
import {
  cmdAudit,
  cmdConfigKeysDelete,
  cmdConfigKeysList,
  cmdConfigKeysSet,
  cmdConfigModel,
  cmdConfigProvider,
  cmdConfigShow,
  cmdDoctor,
  cmdHistory,
  cmdInit,
  cmdRun,
  cmdStatus,
} from "./commands.js";
import { startInteractiveLoop } from "./interactive.js";

// Loaded only as a fallback source for provider config (e.g. PILOT_PROVIDER,
// OLLAMA_HOST). Provider API keys are read from the local encrypted
// credential store, not from process.env — see src/security/credentials.ts.
dotenv.config();

const program = new Command();

program.name("pilot").description("Pilot — a local AI computer agent. Your computer. Your keys. Your control.").version(PILOT_VERSION);

program
  .argument("[prompt...]", "Natural-language task to run immediately")
  .option("-y, --yes", "Auto-approve safe actions for this run")
  .action(async (promptParts: string[], opts: { yes?: boolean }) => {
    const prompt = promptParts.join(" ").trim();
    if (prompt) {
      await cmdRun(prompt, opts);
      return;
    }
    await launchDefaultUI();
  });

program
  .command("run <prompt...>")
  .description("Run a task")
  .option("-y, --yes", "Auto-approve safe actions for this run")
  .action(async (promptParts: string[], opts: { yes?: boolean }) => {
    await cmdRun(promptParts.join(" "), opts);
  });

program.command("init").description("Initialize Pilot's local config").action(cmdInit);
program.command("status").description("Show current provider/model/config status").action(cmdStatus);
program.command("doctor").description("Run diagnostics").action(cmdDoctor);
program.command("history").description("Show recent task history").action(cmdHistory);
program.command("audit").description("Show the local audit log").action(cmdAudit);

const config = program.command("config").description("View or change Pilot configuration");
config.command("show").description("Show current config").action(cmdConfigShow);
config
  .command("provider [name]")
  .description("Get or set the active provider")
  .action((name?: string) => cmdConfigProvider(name));
config
  .command("model [name]")
  .description("Get or set the active model")
  .action((name?: string) => cmdConfigModel(name));

const keys = config.command("keys").description("Manage local provider API keys");
keys.command("list").description("List stored keys (masked)").action(cmdConfigKeysList);
keys
  .command("set <provider>")
  .description("Securely store an API key for a provider")
  .action(async (provider: string) => cmdConfigKeysSet(provider));
keys
  .command("delete <provider>")
  .description("Delete a stored API key")
  .action((provider: string) => cmdConfigKeysDelete(provider));

async function launchDefaultUI(): Promise<void> {
  if (process.stdin.isTTY && process.stdout.isTTY) {
    const { App } = await import("../tui/App.js");
    render(React.createElement(App));
    return;
  }
  await startInteractiveLoop();
}

program.parseAsync(process.argv);
