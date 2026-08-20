import React, { useEffect, useRef, useState } from "react";
import { Box, Text } from "ink";
import { TaskProgress, type ProgressLine } from "../components/TaskProgress.js";
import { ApprovalPrompt } from "../components/ApprovalPrompt.js";
import { theme, symbols } from "../theme.js";
import { runTask } from "../../agent/agent.js";
import type { ApprovalDecision } from "../../security/permissions.js";

export interface RunScreenProps {
  prompt: string;
  autoApproveSafe: boolean;
  onDone: (summary: string, success: boolean) => void;
}

interface PendingApproval {
  action: string;
  summary: string;
  risk: string;
  resolve: (decision: ApprovalDecision) => void;
}

export function RunScreen({ prompt, autoApproveSafe, onDone }: RunScreenProps): JSX.Element {
  const [lines, setLines] = useState<ProgressLine[]>([{ label: "Starting", status: "active" }]);
  const [pending, setPending] = useState<PendingApproval | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    runTask({
      prompt,
      autoApproveSafe,
      approvalPrompter: (request) =>
        new Promise<ApprovalDecision>((resolve) => {
          setPending({ ...request, resolve });
        }),
      onEvent: (event) => {
        setLines((prev) => {
          const next = prev.map((l) => (l.status === "active" ? { ...l, status: "done" as const } : l));
          if (event.type === "final") return next;
          return [...next, { label: event.detail, status: "active" as const }];
        });
      },
    }).then((result) => {
      setLines((prev) => prev.map((l) => (l.status === "active" ? { ...l, status: "done" as const } : l)));
      onDone(result.summary, result.success);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box flexDirection="column">
      <TaskProgress title={prompt} lines={lines} />
      {pending && (
        <Box marginTop={1}>
          <ApprovalPrompt
            action={pending.action}
            summary={pending.summary}
            risk={pending.risk}
            onDecide={(decision) => {
              pending.resolve(decision);
              setPending(null);
            }}
          />
        </Box>
      )}
    </Box>
  );
}

export function RunResultBanner({ summary, success }: { summary: string; success: boolean }): JSX.Element {
  return (
    <Box flexDirection="column" paddingX={1} marginTop={1}>
      <Text color={success ? theme.success : theme.danger}>
        {success ? symbols.check : symbols.cross} {success ? "Task completed" : "Task did not complete"}
      </Text>
      <Text>{summary}</Text>
    </Box>
  );
}
