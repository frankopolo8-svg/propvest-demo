import { NextResponse } from "next/server";
import { uiStringKeys, type UiCopy } from "../../../lib/ui-copy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Criteria = { location?: string; mode?: "sale" | "rent"; maxPrice?: number; minBedrooms?: number; allowNearby?: boolean; propertyType?: string };
type Turn = { role: "assistant" | "user"; text: string };
type ConversationRequest = { messages: Turn[]; criteria?: Criteria };
type UiRequest = { type: "ui"; locale?: string };

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!isConversationRequest(body) && !isUiRequest(body)) return NextResponse.json({ error: "A valid messages array is required." }, { status: 400 });
  const latest = isConversationRequest(body) ? body.messages.at(-1) : undefined;
  if (isConversationRequest(body) && (!latest || latest.role !== "user")) return NextResponse.json({ error: "A user message is required." }, { status: 400 });

  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_CHAT_MODEL || "gpt-4.1-mini";
  if (!apiKey) return NextResponse.json({ error: "Multilingual conversation is not configured." }, { status: 503 });

  const transcript = isConversationRequest(body) ? body.messages.slice(-12).map((message) => `${message.role === "user" ? "Client" : "Assistant"}: ${message.text}`).join("\n") : "";
  const prompt = `You are a calm, expert global real-estate assistant in a chat-first application.

Rules:
- Detect the language of the latest client message and reply naturally in that language; immediately follow an explicit language request.
- Support every language you can reliably understand and generate. Do not restrict language coverage or default to English.
- When the client changes language, retain the entire transcript and retained criteria; never reset location, budget, preferences, or conversation context.
- Keep replies concise, professional, and natural. Ask only one useful follow-up when needed.
- Never invent or claim current listings, prices, addresses, availability, agencies, or market facts. Live results come from a separate provider.
- Return only JSON. For a conversation request return reply (string), criteria, and ui. For a UI-only request return ui only.
- ui must contain locale (BCP 47), all these localized strings: ${uiStringKeys.join(", ")}, suggestions (3 to 5 natural local-language property prompts), and propertyTypes (six distinct localized labels for villa, village house, detached family home, coastal residence, mountain home, and premium residence). Preserve {provider}, {source}, and {time} placeholders in template strings.

Requested UI locale: ${isUiRequest(body) ? body.locale ?? "" : "derive from the latest client message"}
Current retained criteria: ${JSON.stringify(isConversationRequest(body) ? body.criteria ?? {} : {})}
Conversation:
${transcript}`;

  try {
    const upstream = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model, input: prompt, temperature: 0.2 }) });
    const payload = await upstream.json().catch(() => ({})) as { output_text?: string; error?: { message?: string } };
    if (!upstream.ok || !payload.output_text) return NextResponse.json({ error: payload.error?.message || "The conversation service failed." }, { status: 502 });
    const result = parseAssistantResponse(payload.output_text);
    return NextResponse.json(isUiRequest(body) ? { ui: result.ui } : result, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "The conversation service is unavailable." }, { status: 502 }); }
}

function isConversationRequest(value: unknown): value is ConversationRequest { return !!value && typeof value === "object" && Array.isArray((value as { messages?: unknown }).messages) && (value as { messages: unknown[] }).messages.every(isTurn); }
function isUiRequest(value: unknown): value is UiRequest { const locale = value && typeof value === "object" ? (value as { locale?: unknown }).locale : undefined; return !!value && typeof value === "object" && (value as { type?: unknown }).type === "ui" && (locale === undefined || (typeof locale === "string" && /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(locale))); }
function isTurn(value: unknown): value is Turn { return !!value && typeof value === "object" && ((value as { role?: unknown }).role === "assistant" || (value as { role?: unknown }).role === "user") && typeof (value as { text?: unknown }).text === "string" && (value as { text: string }).text.trim().length > 0; }
function parseAssistantResponse(text: string) { const candidate = text.replace(/^```json\s*|\s*```$/g, "").trim(); try { const parsed = JSON.parse(candidate) as { reply?: unknown; criteria?: unknown; ui?: unknown }; const ui = sanitizeUi(parsed.ui); if (typeof parsed.reply === "string" && parsed.reply.trim()) return { reply: parsed.reply.trim(), criteria: sanitizeCriteria(parsed.criteria), ui }; if (Object.keys(ui).length) return { reply: undefined, criteria: {}, ui }; } catch { /* plain text fallback */ } return { reply: text.trim(), criteria: {}, ui: {} }; }
function sanitizeUi(value: unknown): Partial<UiCopy> { if (!value || typeof value !== "object") return {}; const input = value as Record<string, unknown>; const strings = Object.fromEntries(uiStringKeys.flatMap((key) => typeof input[key] === "string" && input[key].trim() ? [[key, input[key].trim().slice(0, 240)]] : [])); const suggestions = Array.isArray(input.suggestions) ? input.suggestions.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim().slice(0, 160)).slice(0, 5) : undefined; const propertyTypes = Array.isArray(input.propertyTypes) ? input.propertyTypes.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim().slice(0, 100)).slice(0, 6) : undefined; const locale = typeof input.locale === "string" && /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(input.locale) ? input.locale : undefined; return { ...strings, ...(suggestions ? { suggestions } : {}), ...(propertyTypes ? { propertyTypes } : {}), ...(locale ? { locale } : {}) } as Partial<UiCopy>; }
function sanitizeCriteria(value: unknown): Criteria { if (!value || typeof value !== "object") return {}; const input = value as Record<string, unknown>; return { location: string(input.location, 200), mode: input.mode === "sale" || input.mode === "rent" ? input.mode : undefined, maxPrice: number(input.maxPrice), minBedrooms: number(input.minBedrooms), allowNearby: input.allowNearby === true ? true : undefined, propertyType: string(input.propertyType, 100) }; }
function string(value: unknown, max: number) { return typeof value === "string" ? value.trim().slice(0, max) || undefined : undefined; }
function number(value: unknown) { return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined; }
