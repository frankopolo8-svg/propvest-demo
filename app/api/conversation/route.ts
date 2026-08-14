import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Criteria = {
  location?: string;
  mode?: "sale" | "rent";
  maxPrice?: number;
  minBedrooms?: number;
  allowNearby?: boolean;
  propertyType?: string;
};

type Turn = { role: "assistant" | "user"; text: string };

type ConversationRequest = { messages: Turn[]; criteria?: Criteria };

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!isConversationRequest(body)) return NextResponse.json({ error: "A valid messages array is required." }, { status: 400 });

  const latest = body.messages.at(-1);
  if (!latest || latest.role !== "user") return NextResponse.json({ error: "A user message is required." }, { status: 400 });

  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_CHAT_MODEL;
  if (!apiKey || !model) return NextResponse.json({ error: "Multilingual conversation is not configured." }, { status: 503 });

  const transcript = body.messages.slice(-12).map((message) => `${message.role === "user" ? "Client" : "Assistant"}: ${message.text}`).join("\n");
  const prompt = `You are a calm, expert global real-estate assistant in a chat-first application.\n\nRules:\n- Reply in the language of the client's latest message, unless they explicitly request another language.\n- Understand any language you can reliably serve; never default to English because the UI is English.\n- Keep the reply concise, professional, and natural. Ask only one useful follow-up when needed.\n- Preserve prior criteria unless the client changes them. Treat towns, villages, neighborhoods, islands, and local place-name variants as valid exact locations.\n- Never invent or claim current listings, prices, addresses, availability, agencies, or market facts. Live results come from a separate provider.\n- Return only JSON, with: reply (string), criteria (object with optional location, mode sale|rent, maxPrice number, minBedrooms number, allowNearby boolean, propertyType string), and ui (object with newChat, input, clear, send, liveDisclaimer translated into the reply language). Populate only criteria explicitly supplied or clearly implied by the client.\n\nCurrent retained criteria: ${JSON.stringify(body.criteria ?? {})}\n\nConversation:\n${transcript}`;

  try {
    const upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, input: prompt, temperature: 0.2 }),
    });
    const payload = await upstream.json().catch(() => ({})) as { output_text?: string; error?: { message?: string } };
    if (!upstream.ok || !payload.output_text) return NextResponse.json({ error: payload.error?.message || "The conversation service failed." }, { status: 502 });
    const result = parseAssistantResponse(payload.output_text);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "The conversation service is unavailable." }, { status: 502 });
  }
}

function isConversationRequest(value: unknown): value is ConversationRequest {
  if (!value || typeof value !== "object" || !Array.isArray((value as { messages?: unknown }).messages)) return false;
  return (value as { messages: unknown[] }).messages.every(isTurn);
}

function isTurn(value: unknown): value is Turn {
  return !!value
    && typeof value === "object"
    && ((value as { role?: unknown }).role === "assistant" || (value as { role?: unknown }).role === "user")
    && typeof (value as { text?: unknown }).text === "string"
    && (value as { text: string }).text.trim().length > 0;
}

function parseAssistantResponse(text: string) {
  const candidate = text.replace(/^```json\s*|\s*```$/g, "").trim();
  try {
    const parsed = JSON.parse(candidate) as { reply?: unknown; criteria?: unknown; ui?: unknown };
    if (typeof parsed.reply === "string" && parsed.reply.trim()) return { reply: parsed.reply.trim(), criteria: sanitizeCriteria(parsed.criteria), ui: sanitizeUi(parsed.ui) };
  } catch { /* handled below */ }
  return { reply: text.trim(), criteria: {}, ui: {} };
}

function sanitizeUi(value: unknown) {
  if (!value || typeof value !== "object") return {};
  const input = value as Record<string, unknown>;
  return Object.fromEntries(["newChat", "input", "clear", "send", "liveDisclaimer"].flatMap((key) => typeof input[key] === "string" ? [[key, input[key].trim().slice(0, 160)]] : []));
}

function sanitizeCriteria(value: unknown): Criteria {
  if (!value || typeof value !== "object") return {};
  const input = value as Record<string, unknown>;
  return {
    location: typeof input.location === "string" ? input.location.trim().slice(0, 200) || undefined : undefined,
    mode: input.mode === "sale" || input.mode === "rent" ? input.mode : undefined,
    maxPrice: number(input.maxPrice), minBedrooms: number(input.minBedrooms),
    allowNearby: input.allowNearby === true ? true : undefined,
    propertyType: typeof input.propertyType === "string" ? input.propertyType.trim().slice(0, 100) || undefined : undefined,
  };
}
function number(value: unknown) { return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined; }
