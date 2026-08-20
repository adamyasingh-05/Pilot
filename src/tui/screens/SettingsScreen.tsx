import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { theme } from "../theme.js";
import { updateConfig } from "../../config/config.js";
import type { PilotConfig } from "../../config/defaults.js";

const FIELDS = ["model", "workspaceRoot", "ollamaHost"] as const satisfies readonly (keyof PilotConfig)[];

export interface SettingsScreenProps {
  config: PilotConfig;
  onChange: (config: PilotConfig) => void;
  onClose: () => void;
}

export function SettingsScreen({ config, onChange, onClose }: SettingsScreenProps): JSX.Element {
  const [index, setIndex] = useState(0);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");

  const field = FIELDS[index]!;

  useInput((_input, key) => {
    if (editing) {
      if (key.escape) setEditing(false);
      return;
    }
    if (key.escape) {
      onClose();
      return;
    }
    if (key.downArrow) setIndex((i) => Math.min(i + 1, FIELDS.length - 1));
    else if (key.upArrow) setIndex((i) => Math.max(i - 1, 0));
    else if (key.return) {
      setValue(String(config[field]));
      setEditing(true);
    }
  });

  function handleSubmit(next: string): void {
    const trimmed = next.trim();
    if (trimmed) {
      onChange(updateConfig({ [field]: trimmed } as Partial<PilotConfig>));
    }
    setEditing(false);
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold>Settings</Text>
      <Text dimColor>↑/↓ select · Enter edit · Esc back</Text>
      <Box flexDirection="column" marginTop={1}>
        {FIELDS.map((f, i) => (
          <Box key={f} justifyContent="space-between">
            <Text color={i === index ? theme.accent : theme.text} inverse={i === index && !editing}>
              {f}
            </Text>
            <Text dimColor>{String(config[f])}</Text>
          </Box>
        ))}
      </Box>
      {editing && (
        <Box marginTop={1}>
          <Text color={theme.accent}>{"> "}</Text>
          <TextInput value={value} onChange={setValue} onSubmit={handleSubmit} />
        </Box>
      )}
      <Box marginTop={1}>
        <Text dimColor>Provider and API keys live under Providers / Credentials.</Text>
      </Box>
    </Box>
  );
}
