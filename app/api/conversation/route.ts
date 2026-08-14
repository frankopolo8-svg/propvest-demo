import { NextResponse } from "next/server";
import { uiStringKeys, type UiCopy } from "../../../lib/ui-copy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Criteria = { location?: string; mode?: "sale" | "rent"; maxPrice?: number; minBedrooms?: number; allowNearby?: boolean; propertyType?: string };
type Turn = { role: "assistant" | "user"; text: string };
type ConversationRequest = { messages: Turn[]; criteria?: Criteria; locale?: string };
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
- ui must contain locale (BCP 47), all these localized strings: ${uiStringKeys.join(", ")}, suggestions (3 to 5 natural local-language property prompts), propertyTypes (six distinct localized labels for villa, village house, detached family home, coastal residence, mountain home, and premium residence), tryAgain, and language. Preserve {provider}, {source}, and {time} placeholders in template strings.

Requested UI locale: ${isUiRequest(body) ? body.locale ?? "" : isConversationRequest(body) ? body.locale ?? "derive from the latest client message" : ""}
Current retained criteria: ${JSON.stringify(isConversationRequest(body) ? body.criteria ?? {} : {})}
Conversation:
${transcript}`;

  try {
    const upstream = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model, input: prompt, temperature: 0.2 }) });
    const payload = await upstream.json().catch(() => ({})) as { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }>; error?: { message?: string } };
    const outputText = payload.output_text || payload.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text" && typeof item.text === "string")?.text;
    if (!upstream.ok || !outputText) {
      console.error("conversation provider request failed", { status: upstream.status, providerMessage: payload.error?.message || "missing output text" });
      return NextResponse.json(isConversationRequest(body) ? demoConversation(body, body.locale) : { ui: {} }, { headers: { "Cache-Control": "no-store", "X-Propvest-Mode": "illustrative-demo" } });
    }
    const result = parseAssistantResponse(outputText);
    return NextResponse.json(isUiRequest(body) ? { ui: result.ui } : result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("conversation provider request threw", { message: error instanceof Error ? error.message : "unknown error" });
    return NextResponse.json(isConversationRequest(body) ? demoConversation(body, body.locale) : { ui: {} }, { headers: { "Cache-Control": "no-store", "X-Propvest-Mode": "illustrative-demo" } });
  }
}

function demoConversation(body: ConversationRequest, locale?: string) {
  const text = body.messages.at(-1)?.text || "";
  const extracted = extractDemoCriteria(text);
  const criteria: Criteria = { ...body.criteria, ...extracted };
  return { reply: demoReply(locale, extracted.propertyType === "Investment property", criteria.location), criteria, ui: {} };
}

function extractDemoCriteria(text: string): Criteria {
  const lower = text.toLocaleLowerCase();
  const investment = /investment|επενδ|inversi|investissement|investition|investimento|استثمار|投资|投資/.test(lower);
  const mode = /rent|rental|lease|ενοικ|alquiler|location|miete|affitto|aluguel|إيجار|出租|賃貸/.test(lower) ? "rent" : "sale";
  const propertyType = investment ? "Investment property" : /villa|βίλα|villa|فيلا|别墅/.test(lower) ? "Villa" : /apartment|apartments|διαμέρισ|apartamento|appartement|wohnung|appartamento|شقة|公寓/.test(lower) ? "Apartment" : /house|home|σπίτι|casa|maison|haus|casa|منزل|住宅/.test(lower) ? "House" : undefined;
  const budgetMatch = text.match(/(?:€|eur|euro|ευρώ|€\s*)\s*([\d.,]+(?:\s*[km])?)/i) || text.match(/(?:under|below|up to|μέχρι|hasta|jusqu|bis zu|fino a|حتى)\s*([\d.,]+(?:\s*[km])?)/i);
  const maxPrice = budgetMatch ? parseMoney(budgetMatch[1]) : undefined;
  const bedroomsMatch = text.match(/(\d+)\s*(?:bed|bedroom|υπνοδωμ|dormitorio|chambre|schlafzimmer|camera|غرف|卧室)/i);
  const minBedrooms = bedroomsMatch ? Number(bedroomsMatch[1]) : undefined;
  const location = extractLocation(text, lower, investment);
  return { ...(location ? { location } : {}), ...(maxPrice ? { maxPrice } : {}), ...(minBedrooms ? { minBedrooms } : {}), ...(propertyType ? { propertyType } : {}), mode, allowNearby: /near|nearby|κοντά|cerca|près|nähe|vicino|بالقرب|附近/.test(lower) };
}

function parseMoney(value: string) { const normalized = value.replace(/\s/g, "").replace(/,/g, ""); const multiplier = /m$/i.test(normalized) ? 1_000_000 : /k$/i.test(normalized) ? 1_000 : 1; const amount = Number(normalized.replace(/[km]/gi, "")); return Number.isFinite(amount) && amount > 0 ? Math.round(amount * multiplier) : undefined; }
function extractLocation(text: string, lower: string, investment: boolean) {
  if (investment && /worldwide|world|παγκόσ|mundial|monde|weltweit|mondo|عالم|世界/.test(lower)) return "Worldwide";
  const match = text.match(/(?:in|near|around|στη(?:ν)?|σε|κοντά(?:\s+σε)?|en|près de|bei|in der|a|في|在)\s+([^,.!?]+?)(?:\s+(?:under|below|up to|μέχρι|hasta|jusqu|bis zu|fino a|حتى)|[,.!?]|$)/i);
  return match?.[1]?.trim().replace(/^(?:a|the)\s+/i, "").slice(0, 120) || undefined;
}

function demoReply(locale: string | undefined, investment: boolean, location?: string) {
  const language = (locale || "en").split("-")[0];
  if (!investment) return { el: "Παρουσιάζω ενδεικτικές επιλογές για το αίτημά σας. Μπορείτε να βελτιώσετε τοποθεσία, προϋπολογισμό ή τύπο ακινήτου.", es: "Te mostraré opciones ilustrativas para tu solicitud. Puedes concretar ubicación, presupuesto o tipo de propiedad.", fr: "Je vais vous présenter des options illustratives. Vous pouvez préciser le lieu, le budget ou le type de bien.", de: "Ich zeige Ihnen passende illustrative Optionen. Sie können Ort, Budget oder Immobilientyp weiter eingrenzen.", it: "Ti mostrerò opzioni illustrative pertinenti. Puoi precisare luogo, budget o tipologia.", ar: "سأعرض خيارات توضيحية مناسبة لطلبك. يمكنك تحديد الموقع أو الميزانية أو نوع العقار.", pt: "Vou mostrar opções ilustrativas relevantes. Pode especificar a localização, o orçamento ou o tipo de imóvel.", tr: "Talebinize uygun örnek seçenekler göstereceğim. Konumu, bütçeyi veya mülk türünü netleştirebilirsiniz.", zh: "我将为您展示相关的示例房产选择。您可以进一步说明地点、预算或房产类型。", ja: "ご希望に合う参考物件をご案内します。場所、予算、物件タイプをさらに絞り込めます。" }[language] || "I’ll show illustrative options for your request. You can refine the location, budget, or property type.";
  return { el: "Παρακάτω θα βρείτε έξι ενδεικτικές επενδυτικές επιλογές από όλο τον κόσμο. Είναι σαφώς επισημασμένες ως demo και μπορείτε να ζητήσετε χώρα, προϋπολογισμό ή απόδοση.", es: "A continuación encontrarás seis opciones de inversión ilustrativas de todo el mundo. Están marcadas como demo; puedes indicar país, presupuesto o rentabilidad.", fr: "Vous trouverez ci-dessous six options d’investissement illustratives dans le monde entier. Elles sont clairement indiquées comme démo ; vous pouvez préciser pays, budget ou rendement.", de: "Unten finden Sie sechs illustrative Anlageoptionen aus aller Welt. Sie sind klar als Demo gekennzeichnet; nennen Sie gern Land, Budget oder Renditewunsch.", it: "Qui sotto trovi sei opzioni d’investimento illustrative da tutto il mondo. Sono chiaramente indicate come demo; puoi specificare paese, budget o rendimento.", ar: "ستجد أدناه ستة خيارات استثمارية توضيحية من أنحاء العالم. وهي مميزة بوضوح كمحتوى تجريبي؛ يمكنك تحديد الدولة أو الميزانية أو العائد.", pt: "Abaixo estão seis opções de investimento ilustrativas de todo o mundo. Estão claramente identificadas como demonstração; pode indicar país, orçamento ou rendimento.", tr: "Aşağıda dünya genelinden altı örnek yatırım seçeneği bulacaksınız. Bunlar açıkça demo olarak işaretlenmiştir; ülke, bütçe veya getiri tercihinizi belirtebilirsiniz.", zh: "以下是来自世界各地的六个示例投资选择。它们均明确标注为演示内容；您可以说明国家、预算或收益偏好。", ja: "以下に世界各地の参考投資物件を6件ご案内します。すべてデモとして明示されており、国・予算・利回りの希望をお伝えいただけます。" }[language] || "Below are six illustrative worldwide investment options. They are clearly marked as demo content; tell me your country, budget, or return preference.";
}

function isConversationRequest(value: unknown): value is ConversationRequest { const locale = value && typeof value === "object" ? (value as { locale?: unknown }).locale : undefined; return !!value && typeof value === "object" && Array.isArray((value as { messages?: unknown }).messages) && (value as { messages: unknown[] }).messages.every(isTurn) && (locale === undefined || isLocale(locale)); }
function isUiRequest(value: unknown): value is UiRequest { const locale = value && typeof value === "object" ? (value as { locale?: unknown }).locale : undefined; return !!value && typeof value === "object" && (value as { type?: unknown }).type === "ui" && (locale === undefined || isLocale(locale)); }
function isLocale(value: unknown): value is string { return typeof value === "string" && /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(value); }
function isTurn(value: unknown): value is Turn { return !!value && typeof value === "object" && ((value as { role?: unknown }).role === "assistant" || (value as { role?: unknown }).role === "user") && typeof (value as { text?: unknown }).text === "string" && (value as { text: string }).text.trim().length > 0; }
function parseAssistantResponse(text: string) { const candidate = text.replace(/^```json\s*|\s*```$/g, "").trim(); try { const parsed = JSON.parse(candidate) as { reply?: unknown; criteria?: unknown; ui?: unknown }; const ui = sanitizeUi(parsed.ui); if (typeof parsed.reply === "string" && parsed.reply.trim()) return { reply: parsed.reply.trim(), criteria: sanitizeCriteria(parsed.criteria), ui }; if (Object.keys(ui).length) return { reply: undefined, criteria: {}, ui }; } catch { /* plain text fallback */ } return { reply: text.trim(), criteria: {}, ui: {} }; }
function sanitizeUi(value: unknown): Partial<UiCopy> { if (!value || typeof value !== "object") return {}; const input = value as Record<string, unknown>; const strings = Object.fromEntries(uiStringKeys.flatMap((key) => typeof input[key] === "string" && input[key].trim() ? [[key, input[key].trim().slice(0, 240)]] : [])); const suggestions = Array.isArray(input.suggestions) ? input.suggestions.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim().slice(0, 160)).slice(0, 5) : undefined; const propertyTypes = Array.isArray(input.propertyTypes) ? input.propertyTypes.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim().slice(0, 100)).slice(0, 6) : undefined; const locale = typeof input.locale === "string" && /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(input.locale) ? input.locale : undefined; return { ...strings, ...(suggestions ? { suggestions } : {}), ...(propertyTypes ? { propertyTypes } : {}), ...(locale ? { locale } : {}) } as Partial<UiCopy>; }
function sanitizeCriteria(value: unknown): Criteria { if (!value || typeof value !== "object") return {}; const input = value as Record<string, unknown>; return { location: string(input.location, 200), mode: input.mode === "sale" || input.mode === "rent" ? input.mode : undefined, maxPrice: number(input.maxPrice), minBedrooms: number(input.minBedrooms), allowNearby: input.allowNearby === true ? true : undefined, propertyType: string(input.propertyType, 100) }; }
function string(value: unknown, max: number) { return typeof value === "string" ? value.trim().slice(0, max) || undefined : undefined; }
function number(value: unknown) { return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined; }
