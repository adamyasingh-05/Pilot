import React from "react";
import { Box, Text, useInput } from "ink";
import { theme } from "../theme.js";
import { getAllNotes } from "../../memory/memory.js";
import { truncate, safeCall } from "../format.js";

export interface MemoryScreenProps {
  onClose: () => void;
}

export function MemoryScreen({ onClose }: MemoryScreenProps): JSX.Element {
  useInput((_input, key) => {
    if (key.escape) onClose();
  });

  const notes = safeCall(() => getAllNotes(), []);

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold>Memory</Text>
      <Text dimColor>Esc back</Text>
      <Box flexDirection="column" marginTop={1}>
        {notes.length === 0 ? (
          <Text dimColor>
            No stored notes yet. Cross-task facts Pilot learns get saved here, local to
            ~/.pilot/memory.sqlite.
          </Text>
        ) : (
          notes.map((n) => (
            <Box key={n.key} flexDirection="column" marginBottom={1}>
              <Box justifyContent="space-between">
                <Text color={theme.accent}>{n.key}</Text>
                <Text dimColor>{n.updated_at}</Text>
              </Box>
              <Text>{truncate(n.value, 60)}</Text>
            </Box>
          ))
        )}
      </Box>
    </Box>
  );
}
