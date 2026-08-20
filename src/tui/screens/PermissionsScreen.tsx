import React from "react";
import { Box, Text, useInput } from "ink";
import { theme } from "../theme.js";
import { updateConfig } from "../../config/config.js";
import type { PilotConfig } from "../../config/defaults.js";

export interface PermissionsScreenProps {
  config: PilotConfig;
  onChange: (config: PilotConfig) => void;
  onClose: () => void;
}

export function PermissionsScreen({ config, onChange, onClose }: PermissionsScreenProps): JSX.Element {
  useInput((input, key) => {
    if (key.escape) {
      onClose();
      return;
    }
    if (key.return || input === " ") {
      onChange(updateConfig({ autoApproveSafe: !config.autoApproveSafe }));
    }
  });

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold>Permissions</Text>
      <Text dimColor>Enter/Space toggle · Esc back</Text>

      <Box marginTop={1} justifyContent="space-between">
        <Text>Auto-approve safe actions</Text>
        <Text color={config.autoApproveSafe ? theme.success : theme.dim}>
          {config.autoApproveSafe ? "on" : "off"}
        </Text>
      </Box>
      <Box>
        <Text dimColor>
          "safe" actions (reads/listings) always run without asking, regardless of this
          setting — it only affects whether other approved-once actions repeat silently for
          the rest of a run.
        </Text>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text dimColor>Risk levels, always enforced:</Text>
        <Text>
          <Text color={theme.success}>safe</Text> — read-only, runs immediately (fs_list, fs_read,
          browser_extract_text, process_list…)
        </Text>
        <Text>
          <Text color={theme.warning}>review</Text> — writes, moves, deletes, kills, clicks, or
          types; asks unless already approved for the session
        </Text>
        <Text>
          <Text color={theme.danger}>dangerous</Text> — destructive shell commands (rm -rf /, fork
          bombs, mkfs…); always asks, "approve all" never covers it
        </Text>
      </Box>
    </Box>
  );
}
