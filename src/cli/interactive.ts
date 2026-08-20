import readline from "node:readline/promises";
import chalk from "chalk";
import { cmdRun } from "./commands.js";

/**
 * Plain-text interactive loop. Used as a fallback when the Ink TUI
 * cannot attach to the terminal (e.g. non-TTY / CI), and directly by
 * `pilot` with no arguments on terminals where Ink is unavailable.
 */
export async function startInteractiveLoop(): Promise<void> {
  console.log(chalk.bold("PILOT") + chalk.dim("  — your computer, your keys, your control"));
  console.log(chalk.dim('Type a task in plain English, or "exit" to quit.\n'));

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  while (true) {
    const input = await rl.question(chalk.cyan("› "));
    const trimmed = input.trim();
    if (!trimmed) continue;
    if (["exit", "quit", ":q"].includes(trimmed.toLowerCase())) break;

    await cmdRun(trimmed, {});
    console.log("");
  }

  rl.close();
}
