/**
 * Build-time configuration verification.
 *
 * Run with `npm run verify:config`. This runs automatically as part of
 * `npm run build` so missing or unsafe configuration is caught before a
 * deploy ships, rather than failing at request time in production.
 *
 * This script never prints full secret values — only safe, truncated
 * previews (first 8 + last 4 characters) via `safeTruncate`.
 */

import { readFileSync } from "fs";
import { join } from "path";
import { validateServerConfig, safeTruncate } from "../lib/config-validation";

const REPO_ROOT = join(__dirname, "..");

/** Names of env vars whose values must never appear hardcoded in source. */
const SECRET_VAR_NAMES = ["OPENAI_API_KEY", "PROPERTY_SEARCH_API_KEY", "OPENAI_CHATKIT_WORKFLOW_ID"];

/** Source globs to scan for accidentally hardcoded secrets. */
const SOURCE_FILES = ["app/api/conversation/route.ts", "lib/property-search.ts", "lib/config-validation.ts", "lib/logging.ts"];

function main(): number {
  console.log("== Propvest configuration verification ==\n");

  let hasFailure = false;

  // 1. Required/optional environment variables.
  const result = validateServerConfig();
  if (!result.valid) {
    hasFailure = true;
    console.error("FAIL: missing required environment variables:");
    for (const name of result.missingVars) {
      console.error(`  - ${name}`);
    }
  } else {
    console.log("PASS: all required environment variables are set.");
  }

  for (const warning of result.warnings) {
    console.warn(`WARN: ${warning}`);
  }

  // 2. Confirm no known secret env var is duplicated with a NEXT_PUBLIC_ prefix.
  const exposedPublicVars = SECRET_VAR_NAMES.filter((name) => Boolean(process.env[`NEXT_PUBLIC_${name}`]));
  if (exposedPublicVars.length > 0) {
    hasFailure = true;
    console.error("FAIL: the following secrets are exposed via NEXT_PUBLIC_ and must be removed:");
    for (const name of exposedPublicVars) {
      console.error(`  - NEXT_PUBLIC_${name}`);
    }
  } else {
    console.log("PASS: no server secrets are exposed via NEXT_PUBLIC_.");
  }

  // 3. Scan known source files for hardcoded-looking secret values.
  const hardcodedFindings = SOURCE_FILES.flatMap((relativePath) => scanForHardcodedSecrets(relativePath));
  if (hardcodedFindings.length > 0) {
    hasFailure = true;
    console.error("FAIL: possible hardcoded secrets found in source:");
    for (const finding of hardcodedFindings) {
      console.error(`  - ${finding}`);
    }
  } else {
    console.log("PASS: no hardcoded secrets detected in scanned source files.");
  }

  // 4. Print safe, truncated previews of configured values for operator sanity-checking.
  console.log("\nConfigured values (safely truncated, never full secrets):");
  console.log(`  OPENAI_API_KEY: ${safeTruncate(process.env.OPENAI_API_KEY)}`);
  console.log(`  OPENAI_CHAT_MODEL: ${process.env.OPENAI_CHAT_MODEL || "(default: gpt-4.1-mini)"}`);
  console.log(`  OPENAI_CHATKIT_WORKFLOW_ID: ${safeTruncate(process.env.OPENAI_CHATKIT_WORKFLOW_ID)}`);
  console.log(`  PROPERTY_SEARCH_API_KEY: ${safeTruncate(process.env.PROPERTY_SEARCH_API_KEY)}`);

  console.log(`\n${hasFailure ? "RESULT: FAIL" : "RESULT: PASS"}`);
  return hasFailure ? 1 : 0;
}

function scanForHardcodedSecrets(relativePath: string): string[] {
  const findings: string[] = [];
  let content: string;
  try {
    content = readFileSync(join(REPO_ROOT, relativePath), "utf8");
  } catch {
    return findings;
  }
  // Matches real-looking OpenAI secret keys (sk-... of substantial length),
  // but not the placeholder "sk-proj-..." used in docs/examples.
  const matches = content.match(/sk-[A-Za-z0-9]{20,}/g);
  if (matches) {
    for (const match of matches) {
      findings.push(`${relativePath}: found value resembling a live API key (${safeTruncate(match)})`);
    }
  }
  return findings;
}

if (require.main === module) {
  process.exit(main());
}
