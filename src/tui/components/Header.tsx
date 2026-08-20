import React from "react";
import { Box, Text } from "ink";
import { theme, symbols } from "../theme.js";

export function Header({ providerLabel }: { providerLabel: string }): JSX.Element {
  return (
    <Box justifyContent="space-between" paddingX={1}>
      <Text bold color={theme.accent}>
        PILOT
      </Text>
      <Text color={theme.success}>
        {symbols.dot} {providerLabel}
      </Text>
    </Box>
  );
}
