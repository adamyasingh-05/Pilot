export class PilotError extends Error {
  public readonly code: string;

  constructor(message: string, code = "PILOT_ERROR") {
    super(message);
    this.name = "PilotError";
    this.code = code;
  }
}

export class ConfigError extends PilotError {
  constructor(message: string) {
    super(message, "CONFIG_ERROR");
    this.name = "ConfigError";
  }
}

export class ProviderError extends PilotError {
  constructor(message: string) {
    super(message, "PROVIDER_ERROR");
    this.name = "ProviderError";
  }
}

export class CredentialError extends PilotError {
  constructor(message: string) {
    super(message, "CREDENTIAL_ERROR");
    this.name = "CredentialError";
  }
}

export class PermissionDeniedError extends PilotError {
  constructor(message: string) {
    super(message, "PERMISSION_DENIED");
    this.name = "PermissionDeniedError";
  }
}

export class ToolExecutionError extends PilotError {
  constructor(message: string) {
    super(message, "TOOL_EXECUTION_ERROR");
    this.name = "ToolExecutionError";
  }
}

export class PathSecurityError extends PilotError {
  constructor(message: string) {
    super(message, "PATH_SECURITY_ERROR");
    this.name = "PathSecurityError";
  }
}

/**
 * Strips stack traces and any potentially sensitive internals before an
 * error is ever shown to the model, printed, or logged. Callers should
 * pass errors through here rather than serializing them directly.
 */
export function toSafeErrorMessage(err: unknown): string {
  if (err instanceof PilotError) return `${err.name}: ${err.message}`;
  if (err instanceof Error) return err.message;
  return String(err);
}
