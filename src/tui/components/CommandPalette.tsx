import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { theme } from "../theme.js";

const COMMANDS = [
  "New Task",
  "History",
  "Memory",
  "Providers",
  "Credentials",
  "Permissions",
  "Settings",
  "Diagnostics",
];

export function CommandPalette({
  onSelect,
  onClose,
}: {
  onSelect: (command: string) => void;
  onClose: () => void;
}): JSX.Element {
  const [index, setIndex] = useState(0);

  useInput((_input, key) => {
    if (key.escape) onClose();
    else if (key.downArrow) setIndex((i) => Math.min(i + 1, COMMANDS.length - 1));
    else if (key.upArrow) setIndex((i) => Math.max(i - 1, 0));
    else if (key.return) onSelect(COMMANDS[index] ?? COMMANDS[0]!);
  });

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.accent} paddingX={1} width={40}>
      <Text dimColor>Search Pilot commands...</Text>
      <Box flexDirection="column" marginTop={1}>
        {COMMANDS.map((cmd, i) => (
          <Text key={cmd} color={i === index ? theme.accent : theme.text} inverse={i === index}>
            {cmd}
          </Text>
        ))}
      </Box>
    </Box>
  );
}
