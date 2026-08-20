import { PermissionDeniedError } from "../core/errors.js";
import { DANGEROUS_COMMAND_PATTERNS } from "../core/constants.js";

export type RiskLevel = "safe" | "review" | "dangerous";

export interface PermissionRequest {
  /** Short machine name of the tool, e.g. "fs.move", "terminal.exec" */
  action: string;
  /** Human-readable summary shown in the approval prompt. */
  summary: string;
  risk: RiskLevel;
}

export type ApprovalDecision = "approve" | "approve_all" | "deny";

/** Injected by the TUI/CLI layer so this module stays framework-agnostic. */
export type ApprovalPrompter = (request: PermissionRequest) => Promise<ApprovalDecision>;

export class PermissionManager {
  private autoApprove = false;
  private sessionApprovedActions = new Set<string>();

  constructor(private readonly prompter: ApprovalPrompter) {}

  /** Call once if the user runs with --yes / approve-all for the session. */
  enableAutoApproveForSession(): void {
    this.autoApprove = true;
  }

  async requestApproval(request: PermissionRequest): Promise<boolean> {
    if (request.risk === "safe") return true;

    if (this.autoApprove && request.risk !== "dangerous") {
      return true;
    }

    if (this.sessionApprovedActions.has(request.action) && request.risk !== "dangerous") {
      return true;
    }

    const decision = await this.prompter(request);

    if (decision === "approve_all") {
      this.sessionApprovedActions.add(request.action);
      return true;
    }

    return decision === "approve";
  }

  requireApprovalOrThrow(approved: boolean, request: PermissionRequest): void {
    if (!approved) {
      throw new PermissionDeniedError(
        `User denied permission for action "${request.action}": ${request.summary}`
      );
    }
  }
}

/** Classifies a shell command's risk before it's even shown for approval. */
export function classifyCommandRisk(command: string): RiskLevel {
  for (const pattern of DANGEROUS_COMMAND_PATTERNS) {
    if (pattern.test(command)) return "dangerous";
  }
  if (/\brm\b|\bmv\b|\bchmod\b|\bchown\b|\bkill\b|\bnpm\s+publish\b|\bgit\s+push\s+--force\b/.test(command)) {
    return "review";
  }
  return "safe";
}

export function classifyFileWriteRisk(_targetPath: string, isDelete: boolean): RiskLevel {
  if (isDelete) return "review";
  return "safe";
}
