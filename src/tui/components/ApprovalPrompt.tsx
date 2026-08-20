import React from "react";
import { Box, Text, useInput } from "ink";
import { theme } from "../theme.js";

export interface ApprovalPromptProps {
  action: string;
  summary: string;
  risk: string;
  onDecide: (decision: "approve" | "approve_all" | "deny") => void;
}

export function ApprovalPrompt({ summary, risk, onDecide }: ApprovalPromptProps): JSX.Element {
  useInput((input) => {
    const key = input.toLowerCase();
    if (key === "y") onDecide("approve");
    else if (key === "a") onDecide("approve_all");
    else if (key === "n") onDecide("deny");
  });

  const riskColor = risk === "dangerous" ? theme.danger : theme.warning;

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={riskColor} paddingX={1}>
      <Text color={riskColor} bold>
        Approval needed [{risk}]
      </Text>
      <Text>{summary}</Text>
      <Box marginTop={1}>
        <Text dimColor>[Y] Approve  [A] Approve all like this  [N] Deny</Text>
      </Box>
    </Box>
  );
}
