/**
 * Minimal structured logging helper that never prints secret values.
 *
 * Use `safeLog` instead of `console.log`/`console.info`/`console.error`
 * directly in server code so every log line carries a timestamp, request id,
 * and level, and so any accidental secret-shaped values in the context
 * object are redacted before they reach stdout.
 */

export type LogLevel = "info" | "warn" | "error";

type LogContext = Record<string, unknown>;

/** Keys whose values should always be redacted, regardless of shape. */
const SENSITIVE_KEYS = new Set([
  "apikey",
  "api_key",
  "openai_api_key",
  "authorization",
  "token",
  "secret",
  "password",
]);

export function safeLog(message: string, context: LogContext = {}, level: LogLevel = "info", requestId?: string): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    requestId: requestId ?? "unknown",
    message,
    ...redact(context),
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

function redact(context: LogContext): LogContext {
  const safe: LogContext = {};
  for (const [key, value] of Object.entries(context)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      safe[key] = "[redacted]";
      continue;
    }
    if (typeof value === "string" && looksLikeSecret(value)) {
      safe[key] = truncate(value);
      continue;
    }
    safe[key] = value;
  }
  return safe;
}

function looksLikeSecret(value: string): boolean {
  return /^sk-[A-Za-z0-9-_]{10,}$/.test(value) || /^wf_[A-Za-z0-9-_]{6,}$/.test(value);
}

function truncate(value: string): string {
  if (value.length <= 12) return "***";
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

/** Generates a short, non-cryptographic id suitable for request tracing in logs. */
export function generateRequestId(): string {
  return `req_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
