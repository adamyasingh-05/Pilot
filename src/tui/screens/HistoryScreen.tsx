import React from "react";
import { Box, Text, useInput } from "ink";
import { theme } from "../theme.js";
import { getRecentTasks } from "../../memory/memory.js";
import { truncate, safeCall } from "../format.js";

export interface HistoryScreenProps {
  onClose: () => void;
}

export function HistoryScreen({ onClose }: HistoryScreenProps): JSX.Element {
  useInput((_input, key) => {
    if (key.escape) onClose();
  });

  const tasks = safeCall(() => getRecentTasks(15), []);

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold>History</Text>
      <Text dimColor>Esc back</Text>
      <Box flexDirection="column" marginTop={1}>
        {tasks.length === 0 && <Text dimColor>No tasks yet — run one from the home screen.</Text>}
        {tasks.map((t) => (
          <Box key={t.id} justifyContent="space-between">
            <Text>
              <Text color={statusColor(t.status)}>{t.status.padEnd(9)}</Text>
              {truncate(t.prompt, 34)}
            </Text>
            <Text dimColor>{t.created_at}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function statusColor(status: string): string {
  if (status === "completed") return theme.success;
  if (status === "failed") return theme.danger;
  return theme.warning;
}
