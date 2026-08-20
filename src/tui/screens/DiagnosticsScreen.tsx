import React, { useEffect, useState } from "react";
import { Box, Text, useInput } from "ink";
import Spinner from "ink-spinner";
import { theme, symbols } from "../theme.js";
import { hasCredential } from "../../security/credentials.js";
import type { PilotConfig } from "../../config/defaults.js";

interface CheckResult {
  label: string;
  ok: boolean;
  detail: string;
}

export interface DiagnosticsScreenProps {
  config: PilotConfig;
  onClose: () => void;
}

export function DiagnosticsScreen({ config, onClose }: DiagnosticsScreenProps): JSX.Element {
  const [results, setResults] = useState<CheckResult[] | null>(null);

  useInput((_input, key) => {
    if (key.escape) onClose();
  });

  useEffect(() => {
    let cancelled = false;

    async function run(): Promise<void> {
      const checks: CheckResult[] = [
        { label: "Node version", ok: true, detail: process.version },
        { label: "Platform", ok: true, detail: process.platform },
        { label: "Config provider", ok: true, detail: `${config.provider} (${config.model})` },
      ];

      if (config.provider === "ollama") {
        try {
          const res = await fetch(`${config.ollamaHost}/api/tags`);
          checks.push({
            label: "Ollama connectivity",
            ok: res.ok,
            detail: res.ok ? `reachable at ${config.ollamaHost}` : `responded with status ${res.status}`,
          });
        } catch {
          checks.push({
            label: "Ollama connectivity",
            ok: false,
            detail: `could not reach ${config.ollamaHost} — try "ollama serve"`,
          });
        }
      } else {
        const has = hasCredential(config.provider);
        checks.push({
          label: "API key",
          ok: has,
          detail: has ? "stored locally" : `run: pilot config keys set ${config.provider}`,
        });
      }

      if (!cancelled) setResults(checks);
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [config.provider, config.ollamaHost, config.model]);

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold>Diagnostics</Text>
      <Text dimColor>Esc back</Text>
      <Box flexDirection="column" marginTop={1}>
        {results === null ? (
          <Text>
            <Text color={theme.accent}>
              <Spinner type="dots" />
            </Text>{" "}
            Running checks…
          </Text>
        ) : (
          results.map((r) => (
            <Box key={r.label} justifyContent="space-between">
              <Text>
                <Text color={r.ok ? theme.success : theme.danger}>
                  {r.ok ? symbols.check : symbols.cross}
                </Text>{" "}
                {r.label}
              </Text>
              <Text dimColor>{r.detail}</Text>
            </Box>
          ))
        )}
      </Box>
    </Box>
  );
}
