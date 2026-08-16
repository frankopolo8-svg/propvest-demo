import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Turn = { role: "assistant" | "user"; text: string };
type ConversationRequest = { messages: Turn[]; criteria?: Record<string, unknown>; locale?: string };

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!isConversationRequest(body)) return error("A valid conversation with a final user message is required.", 400, undefined);

  const apiKey = process.env.OPENAI_API_KEY;
  const workflowId = process.env.OPENAI_CHATKIT_WORKFLOW_ID;
  if (!apiKey || !workflowId) {
    console.error("chatkit.session.unconfigured", { hasApiKey: Boolean(apiKey), hasWorkflowId: Boolean(workflowId) });
    return error("Service unavailable", 503, body.locale);
  }

  try {
    const upstream = await fetch("https://api.openai.com/v1/chatkit/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ workflow_id: workflowId, model: "gpt-4o" }),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    const payload = await upstream.json().catch(() => ({})) as { client_secret?: string; session_id?: string; error?: { message?: string } };
    if (!upstream.ok || !payload.client_secret || !payload.session_id) {
      console.error("chatkit.session.failed", { status: upstream.status, message: payload.error?.message || "missing session credentials" });
      return error("Session creation failed", 502, body.locale);
    }

    console.info("chatkit.session.created", { workflowId, sessionId: payload.session_id });
    return NextResponse.json({ clientSecret: payload.client_secret, sessionId: payload.session_id }, noStore());
  } catch (cause) {
    console.error("chatkit.session.failed", { message: cause instanceof Error ? cause.message : "unknown error" });
    return error("Session creation failed", 502, body.locale);
  }
}

function isConversationRequest(value: unknown): value is ConversationRequest {
  if (!value || typeof value !== "object") return false;
  const input = value as Record<string, unknown>;
  return (
    Array.isArray(input.messages) &&
    input.messages.length > 0 &&
    input.messages.length <= 50 &&
    input.messages.every(isTurn) &&
    (input.messages as Turn[]).at(-1)?.role === "user" &&
    (input.locale === undefined || isLocale(input.locale)) &&
    (input.criteria === undefined || isObject(input.criteria))
  );
}
function isTurn(value: unknown): value is Turn {
  return (
    !!value &&
    typeof value === "object" &&
    ((value as { role?: unknown }).role === "assistant" || (value as { role?: unknown }).role === "user") &&
    typeof (value as { text?: unknown }).text === "string" &&
    (value as { text: string }).text.trim().length > 0 &&
    (value as { text: string }).text.length <= 4000
  );
}
function isLocale(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(value);
}
function isObject(value: unknown) {
  return !!value && typeof value === "object";
}
function noStore() {
  return { headers: { "Cache-Control": "no-store" } };
}
function error(message: string, status: number, locale?: string) {
  return NextResponse.json({ error: localizedError(message, locale) }, { status, ...noStore() });
}
function localizedError(message: string, locale?: string) {
  const lang = locale?.split("-")[0];
  const dictionary: Record<string, Record<string, string>> = {
    "Service unavailable": {
      es: "El servicio no está disponible en este momento.",
      fr: "Le service est actuellement indisponible.",
      de: "Der Dienst ist derzeit nicht verfügbar.",
      it: "Il servizio non è disponibile al momento.",
      el: "Η υπηρεσία δεν είναι διαθέσιμη αυτή τη στιγμή.",
      ar: "الخدمة غير متاحة حالياً.",
      zh: "服务暂时不可用。",
      ja: "サービスは現在ご利用いただけません。",
      pt: "O serviço não está disponível no momento.",
      tr: "Hizmet şu anda kullanılamıyor.",
    },
    "Session creation failed": {
      es: "No se pudo crear la sesión de conversación. Inténtalo de nuevo.",
      fr: "Échec de la création de la session. Veuillez réessayer.",
      de: "Sitzungserstellung fehlgeschlagen. Bitte versuchen Sie es erneut.",
      it: "Creazione della sessione non riuscita. Riprova.",
      el: "Η δημιουργία συνεδρίας απέτυχε. Δοκιμάστε ξανά.",
      ar: "فشل إنشاء الجلسة. يرجى المحاولة مرة أخرى.",
      zh: "会话创建失败,请重试。",
      ja: "セッションの作成に失敗しました。もう一度お試しください。",
      pt: "Falha ao criar a sessão. Tente novamente.",
      tr: "Oturum oluşturulamadı. Lütfen tekrar deneyin.",
    },
    "A valid conversation with a final user message is required.": {
      es: "Se requiere una conversación válida cuyo último mensaje sea del usuario.",
      fr: "Une conversation valide se terminant par un message de l'utilisateur est requise.",
      de: "Eine gültige Konversation mit einer abschließenden Benutzernachricht ist erforderlich.",
      it: "È richiesta una conversazione valida che termini con un messaggio dell'utente.",
      el: "Απαιτείται έγκυρη συνομιλία που να καταλήγει σε μήνυμα χρήστη.",
      ar: "مطلوبة محادثة صالحة تنتهي برسالة من المستخدم.",
      zh: "需要一个有效的对话,且最后一条消息必须来自用户。",
      ja: "有効な会話が必要で、最後のメッセージはユーザーからのものである必要があります。",
      pt: "É necessária uma conversa válida cuja última mensagem seja do usuário.",
      tr: "Son mesajı kullanıcıdan gelen geçerli bir konuşma gereklidir.",
    },
  };
  if (!lang || lang === "en") return message;
  return dictionary[message]?.[lang] || message;
}
