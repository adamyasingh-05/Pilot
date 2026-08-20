import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { theme, symbols } from "../theme.js";
import { SUPPORTED_PROVIDERS, type ProviderId } from "../../core/constants.js";
import { setCredential, deleteCredential, listCredentialPreviews } from "../../security/credentials.js";

const KEY_PROVIDERS = SUPPORTED_PROVIDERS.filter((p) => p !== "ollama") as ProviderId[];

export interface CredentialsScreenProps {
  onClose: () => void;
}

export function CredentialsScreen({ onClose }: CredentialsScreenProps): JSX.Element {
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState<"list" | "input">("list");
  const [inputValue, setInputValue] = useState("");
  const [previews, setPreviews] = useState(() => listCredentialPreviews());
  const [message, setMessage] = useState<string | null>(null);

  const activeProvider = KEY_PROVIDERS[index] as ProviderId;

  useInput((input, key) => {
    if (mode === "input") {
      if (key.escape) {
        setMode("list");
        setInputValue("");
      }
      return;
    }
    if (key.escape) {
      onClose();
      return;
    }
    if (key.downArrow) setIndex((i) => Math.min(i + 1, KEY_PROVIDERS.length - 1));
    else if (key.upArrow) setIndex((i) => Math.max(i - 1, 0));
    else if (key.return) {
      setMessage(null);
      setMode("input");
    } else if (input.toLowerCase() === "d") {
      deleteCredential(activeProvider);
      setPreviews(listCredentialPreviews());
      setMessage(`Removed the stored key for ${activeProvider}.`);
    }
  });

  function handleSubmit(value: string): void {
    const trimmed = value.trim();
    if (trimmed.length >= 8) {
      setCredential(activeProvider, trimmed);
      setPreviews(listCredentialPreviews());
      setMessage(`Stored key for ${activeProvider}, encrypted at ~/.pilot/keys.`);
    } else if (trimmed.length > 0) {
      setMessage("That key looks too short — nothing was stored.");
    }
    setInputValue("");
    setMode("list");
  }

  const preview = previews.find((p) => p.provider === activeProvider);

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold>Credentials</Text>
      <Text dimColor>↑/↓ select · Enter set key · D delete · Esc back</Text>
      <Box flexDirection="column" marginTop={1}>
        {KEY_PROVIDERS.map((id, i) => {
          const p = previews.find((pv) => pv.provider === id);
          return (
            <Box key={id} justifyContent="space-between">
              <Text color={i === index ? theme.accent : theme.text} inverse={i === index}>
                {id}
              </Text>
              <Text color={p ? theme.success : theme.dim}>{p ? p.preview : "not set"}</Text>
            </Box>
          );
        })}
      </Box>

      {mode === "input" && (
        <Box marginTop={1}>
          <Text color={theme.accent}>
            {symbols.bullet} Key for {activeProvider}:{" "}
          </Text>
          <TextInput value={inputValue} onChange={setInputValue} onSubmit={handleSubmit} mask="*" />
        </Box>
      )}

      {mode === "list" && message && (
        <Box marginTop={1}>
          <Text dimColor>{message}</Text>
        </Box>
      )}

      {mode === "list" && preview && (
        <Box marginTop={1}>
          <Text dimColor>Set {preview.createdAt}. Keys are never printed, logged, or sent anywhere but the provider's API.</Text>
        </Box>
      )}
    </Box>
  );
}
