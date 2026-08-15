/**
 * Server-side configuration validation.
 *
 * This module never logs or returns full secret values. Any value that looks
 * like a credential is truncated with `safeTruncate()` before it is ever
 * placed in a log line, error message, or response body.
 */

export type ConfigValidationResult = {
  valid: boolean;
  missingVars: string[];
  warnings: string[];
};

type RequiredVar = {
  name: string;
  description: string;
};

type OptionalGroupVar = {
  name: string;
  description: string;
};

/** Environment variables that MUST be present for the server to function. */
const REQUIRED_VARS: RequiredVar[] = [
  {
    name: "OPENAI_API_KEY",
    description:
      "OpenAI API key used to call the Responses API. Get one from https://platform.openai.com/api-keys.",
  },
];

/**
 * Optional variables that, when partially configured, should raise a warning
 * so misconfiguration is caught early instead of failing silently at request
 * time.
 */
const OPTIONAL_PROPERTY_SEARCH_VARS: OptionalGroupVar[] = [
  { name: "PROPERTY_SEARCH_API_URL", description: "Live inventory search endpoint." },
  { name: "PROPERTY_SEARCH_API_KEY", description: "Bearer credential for the listing provider." },
  { name: "PROPERTY_SEARCH_PROVIDER", description: "Display name for verified listing results." },
];

/**
 * Names of variables that must never be exposed to the client. If any of
 * these were accidentally prefixed with NEXT_PUBLIC_ and set, that is a
 * critical misconfiguration because Next.js inlines NEXT_PUBLIC_ values into
 * the client bundle at build time.
 */
const SENSITIVE_VAR_NAMES = [
  "OPENAI_API_KEY",
  "OPENAI_CHATKIT_WORKFLOW_ID",
  "PROPERTY_SEARCH_API_KEY",
];

/**
 * Validates that all required server-side configuration is present, and
 * collects non-fatal warnings (e.g. partially configured optional features,
 * or sensitive values accidentally exposed via NEXT_PUBLIC_).
 *
 * Safe to call on every request; it does not perform any I/O and does not
 * log anything by itself.
 */
export function validateServerConfig(): ConfigValidationResult {
  const missingVars: string[] = [];
  const warnings: string[] = [];

  for (const variable of REQUIRED_VARS) {
    const value = process.env[variable.name];
    if (!value || !value.trim()) {
      missingVars.push(variable.name);
    }
  }

  const propertySearchValues = OPTIONAL_PROPERTY_SEARCH_VARS.map((variable) => ({
    variable,
    present: Boolean(process.env[variable.name]?.trim()),
  }));
  const anyPropertySearchConfigured = propertySearchValues.some((entry) => entry.present);
  const allPropertySearchConfigured = propertySearchValues.every((entry) => entry.present);
  if (anyPropertySearchConfigured && !allPropertySearchConfigured) {
    const missing = propertySearchValues.filter((entry) => !entry.present).map((entry) => entry.variable.name);
    warnings.push(
      `Property search is partially configured. Missing: ${missing.join(", ")}. Live inventory search will be disabled until all three are set.`,
    );
  }

  for (const name of SENSITIVE_VAR_NAMES) {
    const publicEquivalent = `NEXT_PUBLIC_${name}`;
    if (process.env[publicEquivalent]) {
      warnings.push(
        `${publicEquivalent} is set. Secrets must never be exposed with a NEXT_PUBLIC_ prefix because Next.js inlines them into the client bundle. Remove ${publicEquivalent} and use ${name} instead.`,
      );
    }
  }

  const model = process.env.OPENAI_CHAT_MODEL;
  if (model !== undefined && !model.trim()) {
    warnings.push("OPENAI_CHAT_MODEL is set but empty. The default model (gpt-4.1-mini) will be used instead.");
  }

  return {
    valid: missingVars.length === 0,
    missingVars,
    warnings,
  };
}

/**
 * Produces a human-readable, safe-to-return error message describing which
 * required variables are missing. Never includes variable values.
 */
export function describeMissingConfig(missingVars: string[]): string {
  if (missingVars.length === 0) return "";
  const known = new Map(REQUIRED_VARS.map((variable) => [variable.name, variable.description]));
  return missingVars.map((name) => `${name}: ${known.get(name) ?? "required but not set"}`).join(" | ");
}

/**
 * Safely truncates a secret-like string for diagnostic purposes only. Shows
 * the first 8 and last 4 characters, e.g. "sk-proj-...wxyz". Never call this
 * with a full key intended to remain private beyond local debugging — the
 * result should still not be logged in production.
 */
export function safeTruncate(value: string | undefined | null): string {
  if (!value) return "(not set)";
  const trimmed = value.trim();
  if (trimmed.length <= 12) return "***";
  return `${trimmed.slice(0, 8)}...${trimmed.slice(-4)}`;
}
