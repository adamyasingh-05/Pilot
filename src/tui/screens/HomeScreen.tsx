import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { theme, symbols } from "../theme.js";
import type { TaskRecord } from "../../memory/memory.js";

export interface HomeScreenProps {
  recentTasks: TaskRecord[];
  onSubmit: (prompt: string) => void;
}

export function HomeScreen({ recentTasks, onSubmit }: HomeScreenProps): JSX.Element {
  const [value, setValue] = useState("");

  useInput((_input, key) => {
    if (key.return && value.trim()) {
      onSubmit(value.trim());
      setValue("");
    }
  });

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text>What would you like me to do?</Text>
      <Box marginTop={1}>
        <Text color={theme.accent}>{symbols.bullet} </Text>
        <TextInput value={value} onChange={setValue} onSubmit={onSubmit} placeholder="Organize my Downloads folder" />
      </Box>

      {recentTasks.length > 0 && (
        <Box flexDirection="column" marginTop={2}>
          <Text dimColor>────────────────────────────────────────</Text>
          <Text bold>Recent</Text>
          {recentTasks.slice(0, 5).map((task) => (
            <Box key={task.id} justifyContent="space-between">
              <Text>
                {symbols.bullet} {truncate(task.prompt, 42)}
              </Text>
              <Text dimColor>{relativeTime(task.created_at)}</Text>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso + "Z").getTime();
  const mins = Math.max(0, Math.floor(diffMs / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
