import React, { useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { Header } from "./components/Header.js";
import { CommandPalette } from "./components/CommandPalette.js";
import { HomeScreen } from "./screens/HomeScreen.js";
import { RunScreen, RunResultBanner } from "./screens/RunScreen.js";
import { ProvidersScreen } from "./screens/ProvidersScreen.js";
import { CredentialsScreen } from "./screens/CredentialsScreen.js";
import { PermissionsScreen } from "./screens/PermissionsScreen.js";
import { SettingsScreen } from "./screens/SettingsScreen.js";
import { DiagnosticsScreen } from "./screens/DiagnosticsScreen.js";
import { HistoryScreen } from "./screens/HistoryScreen.js";
import { MemoryScreen } from "./screens/MemoryScreen.js";
import { theme } from "./theme.js";
import { loadConfig } from "../config/config.js";
import type { PilotConfig } from "../config/defaults.js";
import { getRecentTasks, type TaskRecord } from "../memory/memory.js";

type Screen =
  | { name: "home" }
  | { name: "run"; prompt: string }
  | { name: "result"; summary: string; success: boolean }
  | { name: "providers" }
  | { name: "credentials" }
  | { name: "permissions" }
  | { name: "settings" }
  | { name: "diagnostics" }
  | { name: "history" }
  | { name: "memory" };

type PaletteTarget = Exclude<Screen["name"], "run" | "result">;

// Every command the palette lists routes to a real screen now — nothing
// falls through to "handled via the CLI today" anymore.
const PALETTE_ROUTES: Record<string, PaletteTarget> = {
  "New Task": "home",
  History: "history",
  Memory: "memory",
  Providers: "providers",
  Credentials: "credentials",
  Permissions: "permissions",
  Settings: "settings",
  Diagnostics: "diagnostics",
};

export function App(): JSX.Element {
  const { exit } = useApp();
  const [config, setConfig] = useState<PilotConfig>(() => loadConfig());
  const [screen, setScreen] = useState<Screen>({ name: "home" });
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [recentTasks, setRecentTasks] = useState<TaskRecord[]>(() => safeRecentTasks());

  useInput((input, key) => {
    if (key.ctrl && input === "k") {
      setPaletteOpen((open) => !open);
    }
    if (key.ctrl && input === "c") {
      exit();
    }
  });

  function handleSubmit(prompt: string): void {
    setScreen({ name: "run", prompt });
  }

  function handleDone(summary: string, success: boolean): void {
    setScreen({ name: "result", summary, success });
    setRecentTasks(safeRecentTasks());
  }

  function handlePaletteSelect(command: string): void {
    setPaletteOpen(false);
    const target = PALETTE_ROUTES[command];
    if (target) setScreen({ name: target } as Screen);
  }

  function goHome(): void {
    setScreen({ name: "home" });
    setRecentTasks(safeRecentTasks());
  }

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.border} width={64}>
      <Header providerLabel={providerLabel(config.provider, config.model)} />
      <Box borderStyle="single" borderColor={theme.border} borderTop borderBottom={false} borderLeft={false} borderRight={false} />

      <Box flexDirection="column" paddingY={1}>
        {paletteOpen ? (
          <CommandPalette onSelect={handlePaletteSelect} onClose={() => setPaletteOpen(false)} />
        ) : screen.name === "home" ? (
          <HomeScreen recentTasks={recentTasks} onSubmit={handleSubmit} />
        ) : screen.name === "run" ? (
          <RunScreen prompt={screen.prompt} autoApproveSafe={config.autoApproveSafe} onDone={handleDone} />
        ) : screen.name === "result" ? (
          <Box flexDirection="column">
            <RunResultBanner summary={screen.summary} success={screen.success} />
            <Box marginTop={1} paddingX={1}>
              <Text dimColor>Press Enter to start a new task.</Text>
            </Box>
            <NewTaskListener onEnter={goHome} />
          </Box>
        ) : screen.name === "providers" ? (
          <ProvidersScreen config={config} onChange={setConfig} onClose={goHome} />
        ) : screen.name === "credentials" ? (
          <CredentialsScreen onClose={goHome} />
        ) : screen.name === "permissions" ? (
          <PermissionsScreen config={config} onChange={setConfig} onClose={goHome} />
        ) : screen.name === "settings" ? (
          <SettingsScreen config={config} onChange={setConfig} onClose={goHome} />
        ) : screen.name === "diagnostics" ? (
          <DiagnosticsScreen config={config} onClose={goHome} />
        ) : screen.name === "history" ? (
          <HistoryScreen onClose={goHome} />
        ) : (
          <MemoryScreen onClose={goHome} />
        )}
      </Box>

      <Box borderStyle="single" borderColor={theme.border} borderTop borderBottom={false} borderLeft={false} borderRight={false} />
      <Box paddingX={1}>
        <Text dimColor>{footerHint(screen.name, paletteOpen)}</Text>
      </Box>
    </Box>
  );
}

function NewTaskListener({ onEnter }: { onEnter: () => void }): null {
  useInput((_input, key) => {
    if (key.return) onEnter();
  });
  return null;
}

function footerHint(name: Screen["name"], paletteOpen: boolean): string {
  if (paletteOpen) return "↑/↓ Navigate   Enter Select   Esc Close";
  if (name === "home") return "Enter Run   Ctrl+K Commands   Ctrl+C Exit";
  if (name === "run") return "Ctrl+C Exit";
  if (name === "result") return "Enter New Task   Ctrl+C Exit";
  return "Esc Back   Ctrl+K Commands   Ctrl+C Exit";
}

function providerLabel(provider: string, model: string): string {
  const name = provider.charAt(0).toUpperCase() + provider.slice(1);
  return `${name} Connected · ${model}`;
}

function safeRecentTasks(): TaskRecord[] {
  try {
    return getRecentTasks(5);
  } catch {
    return [];
  }
}
