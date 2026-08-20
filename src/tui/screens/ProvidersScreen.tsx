import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { theme, symbols } from "../theme.js";
import { SUPPORTED_PROVIDERS, type ProviderId } from "../../core/constants.js";
import { DEFAULT_MODELS } from "../../config/defaults.js";
import { updateConfig } from "../../config/config.js";
import { hasCredential } from "../../security/credentials.js";
import type { PilotConfig } from "../../config/defaults.js";

export interface ProvidersScreenProps {
  config: PilotConfig;
  onChange: (config: PilotConfig) => void;
  onClose: () => void;
}

export function ProvidersScreen({ config, onChange, onClose }: ProvidersScreenProps): JSX.Element {
  const [index, setIndex] = useState(() =>
    Math.max(0, SUPPORTED_PROVIDERS.indexOf(config.provider))
  );
  const [message, setMessage] = useState<string | null>(null);

  useInput((_input, key) => {
    if (key.escape) {
      onClose();
      return;
    }
    if (key.downArrow) setIndex((i) => Math.min(i + 1, SUPPORTED_PROVIDERS.length - 1));
    else if (key.upArrow) setIndex((i) => Math.max(i - 1, 0));
    else if (key.return) {
      const providerId = SUPPORTED_PROVIDERS[index] as ProviderId;
      const next = updateConfig({ provider: providerId, model: DEFAULT_MODELS[providerId] });
      onChange(next);
      setMessage(
        providerId === "ollama" || hasCredential(providerId)
          ? `Switched to ${providerId} (${next.model}).`
          : `Switched to ${providerId} — no API key stored yet. Set one from Credentials.`
      );
    }
  });

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold>Providers</Text>
      <Text dimColor>↑/↓ select · Enter set active · Esc back</Text>
      <Box flexDirection="column" marginTop={1}>
        {SUPPORTED_PROVIDERS.map((id, i) => {
          const active = id === config.provider;
          const ready = id === "ollama" || hasCredential(id);
          return (
            <Box key={id} justifyContent="space-between">
              <Text color={i === index ? theme.accent : theme.text} inverse={i === index}>
                {active ? `${symbols.dot} ` : "  "}
                {id}
                {id === "ollama" ? "" : `  (${DEFAULT_MODELS[id]})`}
              </Text>
              <Text color={ready ? theme.success : theme.dim}>
                {id === "ollama" ? "no key needed" : ready ? "key set" : "no key"}
              </Text>
            </Box>
          );
        })}
      </Box>
      {message && (
        <Box marginTop={1}>
          <Text dimColor>{message}</Text>
        </Box>
      )}
    </Box>
  );
}
