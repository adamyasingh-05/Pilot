import React from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { theme, symbols } from "../theme.js";

export interface ProgressLine {
  label: string;
  status: "done" | "active" | "pending";
}

export function TaskProgress({ title, lines }: { title: string; lines: ProgressLine[] }): JSX.Element {
  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold>{title}</Text>
      <Box flexDirection="column" marginTop={1}>
        {lines.map((line, i) => (
          <Box key={i}>
            {line.status === "done" && <Text color={theme.success}>{symbols.check} </Text>}
            {line.status === "active" && (
              <Text color={theme.accent}>
                <Spinner type="dots" />{" "}
              </Text>
            )}
            {line.status === "pending" && <Text color={theme.dim}>{symbols.dot} </Text>}
            <Text color={line.status === "pending" ? theme.dim : theme.text}>{line.label}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
