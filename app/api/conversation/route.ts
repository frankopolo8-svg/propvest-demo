import { NextResponse } from "next/server";
import { PropertySearchConfigurationError, PropertySearchProviderError, searchVerifiedListings, type PropertySearchResponse } from "../../../lib/property-search";
import { validateServerConfig } from "../../../lib/config-validation";
import { generateRequestId, safeLog } from "../../../lib/logging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// NOTE: This endpoint has no rate limiting yet. Before scaling traffic,
// consider adding a per-IP/per-session limiter (e.g. Upstash Ratelimit or a
// Railway-hosted Redis token bucket) here to protect the OpenAI budget and
// the configured property search provider from abuse.

const ALLOWED_MODELS_PATTERN = /^gpt-[\w.-]+$/;

type Criteria = { location?: string; mode?: "sale" | "rent"; maxPrice?: number; minBedrooms?: number; allowNearby?: boolean; propertyType?: string };
type Turn = { role: "assistant" | "user"; text: string };
type Preferences = { currency?: string; features?: string[]; minBathrooms?: number; minAreaSqm?: number };
type ConversationRequest = { messages: Turn[]; criteria?: Criteria; locale?: string; preferences?: Preferences };
type Analysis = { criteria: Criteria; shouldSearchProperties: boolean };

export async function POST(request: Request) {
  const requestId = generateRequestId();

  const configResult = validateServerConfig();
  for (const warning of configResult.warnings) {
    safeLog("conversation.config.warning", { warning }, "warn", requestId);
  }
  if (!configResult.valid) {
    // Never expose which specific variables are missing to the client;
    // that is only safe to log server-side.
    safeLog("conversation.config.invalid", { missingVars: configResult.missingVars }, "error", requestId);
    return error("The AI conversation service is not configured. Please contact the site administrator.", 503, undefined);
  }

  const body = await request.json().catch(() => null);
  if (!isConversationRequest(body)) return error("A valid conversation with a final user message is required.", 400, "en");
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return error("The AI conversation service is not configured.", 503, body.locale);
  const rawModel = process.env.OPENAI_CHAT_MODEL || "gpt-4.1-mini";
  const model = ALLOWED_MODELS_PATTERN.test(rawModel) ? rawModel : "gpt-4.1-mini";
  if (model !== rawModel) {
    safeLog("conversation.config.invalid_model", { configuredModel: rawModel }, "warn", requestId);
  }

  safeLog("conversation.ai.analysis.start", { messages: body.messages.length, locale: body.locale }, "info", requestId);
  const analysis = await analyze({ apiKey, model, request: body, requestId });
  if (analysis instanceof NextResponse) return analysis;
  safeLog("conversation.ai.analysis.complete", { search: analysis.shouldSearchProperties, hasLocation: Boolean(analysis.criteria.location) }, "info", requestId);

  let properties: PropertySearchResponse | undefined;
  let toolError: string | undefined;
  if (analysis.shouldSearchProperties && analysis.criteria.location) {
    safeLog("conversation.property_search.start", { location: analysis.criteria.location, mode: analysis.criteria.mode ?? "sale" }, "info", requestId);
    try {
      properties = await searchVerifiedListings({ location: analysis.criteria.location, mode: analysis.criteria.mode ?? "sale", maxPrice: analysis.criteria.maxPrice, minBedrooms: analysis.criteria.minBedrooms, minBathrooms: body.preferences?.minBathrooms, minAreaSqm: body.preferences?.minAreaSqm, currency: body.preferences?.currency, features: body.preferences?.features, allowNearby: analysis.criteria.allowNearby });
      safeLog("conversation.property_search.complete", { exactMatches: properties.exactMatches.length, nearbyOpportunities: properties.nearbyOpportunities.length }, "info", requestId);
    } catch (cause) {
      safeLog("conversation.property_search.failed", { message: cause instanceof Error ? cause.message : "unknown error" }, "error", requestId);
      toolError = cause instanceof PropertySearchConfigurationError ? "LIVE_INVENTORY_NOT_CONFIGURED" : cause instanceof PropertySearchProviderError ? "LIVE_INVENTORY_UNAVAILABLE" : "LIVE_INVENTORY_FAILED";
    }
  }

  safeLog("conversation.ai.presentation.start", { hasResults: Boolean(properties), toolError }, "info", requestId);
  const reply = await present({ apiKey, model, request: body, analysis, properties, toolError, requestId });
  if (reply instanceof NextResponse) return reply;
  safeLog("conversation.ai.presentation.complete", { hasResults: Boolean(properties) }, "info", requestId);
  return NextResponse.json({ reply, criteria: analysis.criteria, properties, ...(toolError ? { propertySearchError: localizedToolError(toolError, body.locale) } : {}) }, noStore());
}

async function analyze({ apiKey, model, request, requestId }: { apiKey: string; model: string; request: ConversationRequest; requestId: string }): Promise<Analysis | NextResponse> {
  const output = await callAi({ apiKey, model, locale: request.locale, phase: "analysis", input: { conversation: request.messages.slice(-20), retainedCriteria: request.criteria ?? {}, preferences: request.preferences ?? {} }, schema: analysisSchema, requestId });
  if (output instanceof NextResponse) return output;
  try { const parsed = JSON.parse(output) as { criteria?: unknown; shouldSearchProperties?: unknown }; if (typeof parsed.shouldSearchProperties !== "boolean") throw new Error(); return { criteria: sanitizeCriteria(parsed.criteria), shouldSearchProperties: parsed.shouldSearchProperties }; } catch { return error("The AI conversation service returned an invalid analysis. Please try again.", 502, request.locale); }
}
async function present({ apiKey, model, request, analysis, properties, toolError, requestId }: { apiKey: string; model: string; request: ConversationRequest; analysis: Analysis; properties?: PropertySearchResponse; toolError?: string; requestId: string }): Promise<string | NextResponse> {
  const output = await callAi({ apiKey, model, locale: request.locale, phase: "presentation", input: { conversation: request.messages.slice(-20), criteria: analysis.criteria, inventory: properties, toolError }, schema: replySchema, requestId });
  if (output instanceof NextResponse) return output;
  try { const parsed = JSON.parse(output) as { reply?: unknown }; return typeof parsed.reply === "string" && parsed.reply.trim() ? parsed.reply.trim().slice(0, 2000) : error("The AI conversation service returned an invalid response. Please try again.", 502, request.locale); } catch { return error("The AI conversation service returned an invalid response. Please try again.", 502, request.locale); }
}
async function callAi({ apiKey, model, locale, phase, input, schema, requestId }: { apiKey: string; model: string; locale?: string; phase: "analysis" | "presentation"; input: unknown; schema: object; requestId: string }): Promise<string | NextResponse> {
  const instructions = phase === "analysis"
    ? "You are Propvest's AI brain. Analyze every user message using conversation history, selected locale, preferences, and retained criteria. Decide whether to search live inventory. Extract only requested criteria. Never generate user-facing replies, listings, or tool calls. Return JSON matching the schema."
    : "You are Propvest's AI brain. Create the final concise, professional user-facing answer in the selected locale using conversation history, analyzed criteria, and provided inventory/tool results. Explain results naturally; never invent listing facts, availability, or prices. If inventory is unavailable, clearly explain that and offer the next helpful step. Return JSON matching the schema.";
  try {
    // Note: `apiKey` is only ever used in this Authorization header and is
    // never included in any logged object below.
    const upstream = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model, input: [{ role: "developer", content: `${instructions} Selected locale: ${locale || "derive from latest user message"}.` }, { role: "user", content: JSON.stringify(input) }], temperature: 0.2, max_output_tokens: 1000, text: { format: { type: "json_schema", name: `propvest_${phase}`, strict: true, schema } } }), cache: "no-store", signal: AbortSignal.timeout(20_000) });
    const payload = await upstream.json().catch(() => ({})) as { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }>; error?: { message?: string } };
    const text = payload.output_text || payload.output?.flatMap((part) => part.content ?? []).find((part) => part.type === "output_text" && typeof part.text === "string")?.text;
    if (!upstream.ok || !text) { safeLog(`conversation.ai.${phase}.failed`, { status: upstream.status, message: payload.error?.message || "missing structured output" }, "error", requestId); return error("The AI conversation service could not complete this request. Please try again.", upstream.status === 429 ? 429 : 502, locale); }
    return text;
  } catch (cause) { safeLog(`conversation.ai.${phase}.failed`, { message: cause instanceof Error ? cause.message : "unknown error" }, "error", requestId); return error("The AI conversation service is unavailable. Please try again.", 502, locale); }
}
const criteriaSchema = { type: "object", additionalProperties: false, required: ["location", "mode", "maxPrice", "minBedrooms", "allowNearby", "propertyType"], properties: { location: { type: ["string", "null"] }, mode: { type: ["string", "null"], enum: ["sale", "rent", null] }, maxPrice: { type: ["number", "null"] }, minBedrooms: { type: ["number", "null"] }, allowNearby: { type: ["boolean", "null"] }, propertyType: { type: ["string", "null"] } } } as const;
const analysisSchema = { type: "object", additionalProperties: false, required: ["criteria", "shouldSearchProperties"], properties: { criteria: criteriaSchema, shouldSearchProperties: { type: "boolean" } } } as const;
const replySchema = { type: "object", additionalProperties: false, required: ["reply"], properties: { reply: { type: "string", minLength: 1, maxLength: 2000 } } } as const;
function isConversationRequest(value: unknown): value is ConversationRequest { if (!value || typeof value !== "object") return false; const input = value as Record<string, unknown>; return Array.isArray(input.messages) && input.messages.length > 0 && input.messages.length <= 50 && input.messages.every(isTurn) && (input.messages as Turn[]).at(-1)?.role === "user" && (input.locale === undefined || isLocale(input.locale)) && (input.criteria === undefined || isObject(input.criteria)) && (input.preferences === undefined || isObject(input.preferences)); }
function isTurn(value: unknown): value is Turn { return !!value && typeof value === "object" && ((value as { role?: unknown }).role === "assistant" || (value as { role?: unknown }).role === "user") && typeof (value as { text?: unknown }).text === "string" && (value as { text: string }).text.trim().length > 0 && (value as { text: string }).text.length <= 4000; }
function isLocale(value: unknown): value is string { return typeof value === "string" && /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(value); }
function isObject(value: unknown) { return !!value && typeof value === "object"; }
function sanitizeCriteria(value: unknown): Criteria { if (!isObject(value)) return {}; const input = value as Record<string, unknown>; return { location: optionalString(input.location, 200), mode: input.mode === "sale" || input.mode === "rent" ? input.mode : undefined, maxPrice: optionalNumber(input.maxPrice), minBedrooms: optionalNumber(input.minBedrooms), allowNearby: input.allowNearby === true ? true : undefined, propertyType: optionalString(input.propertyType, 100) }; }
function optionalString(value: unknown, max: number) { return typeof value === "string" ? value.trim().slice(0, max) || undefined : undefined; }
function optionalNumber(value: unknown) { return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined; }
function localizedToolError(code: string, locale?: string) { const lang = locale?.split("-")[0]; const messages: Record<string, string> = { es: "El inventario inmobiliario en vivo no está disponible en este momento.", fr: "L’inventaire immobilier en direct est indisponible pour le moment.", de: "Der Live-Immobilienbestand ist derzeit nicht verfügbar.", it: "L’inventario immobiliare in tempo reale non è disponibile.", el: "Το ζωντανό απόθεμα ακινήτων δεν είναι διαθέσιμο αυτή τη στιγμή.", ar: "مخزون العقارات المباشر غير متاح حالياً.", zh: "实时房源暂时不可用。", ja: "ライブ物件在庫は現在利用できません。", pt: "O inventário imobiliário ao vivo não está disponível no momento.", tr: "Canlı emlak envanteri şu anda kullanılamıyor." }; return messages[lang || ""] || "The live property inventory is unavailable right now."; }
function noStore() { return { headers: { "Cache-Control": "no-store" } }; }
function error(message: string, status: number, locale?: string) { return NextResponse.json({ error: localizedError(message, locale) }, { status, ...noStore() }); }
function localizedError(message: string, locale?: string) { return locale?.startsWith("en") || !locale ? message : localizedToolError("AI", locale); }
