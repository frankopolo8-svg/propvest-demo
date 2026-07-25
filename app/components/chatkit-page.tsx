"use client";

import { useEffect, useMemo, useState } from "react";
import { ChatKit, useChatKit } from "@openai/chatkit-react";

const chatkitDomainKey = process.env.NEXT_PUBLIC_OPENAI_CHATKIT_DOMAIN_KEY;

async function getClientSecret(currentSecret: string | null) {
  if (currentSecret) return currentSecret;

  const response = await fetch("/api/chatkit/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  const payload = (await response.json().catch(() => ({}))) as {
    client_secret?: string;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error ?? "Failed to create ChatKit session");
  }

  if (!payload.client_secret) {
    throw new Error("ChatKit session response did not include a client secret");
  }

  return payload.client_secret;
}

export function ChatKitPage() {
  const [isReady, setIsReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const api = useMemo(
    () => ({
      getClientSecret,
      ...(chatkitDomainKey ? { domainKey: chatkitDomainKey } : {}),
    }),
    [],
  );
  const chatkit = useChatKit({
    api,
    onReady: () => {
      setErrorMessage(null);
      setIsReady(true);
    },
    onError: ({ error }) => {
      setErrorMessage(error.message || "ChatKit failed to load.");
    },
  });

  useEffect(() => {
    if (isReady || errorMessage) return;

    const timeout = window.setTimeout(() => {
      setErrorMessage("ChatKit is taking longer than expected to load. Check the ChatKit script and session configuration.");
    }, 15000);

    return () => window.clearTimeout(timeout);
  }, [errorMessage, isReady]);

  return (
    <main className="chatkit-shell">
      <div className="chatkit-frame">
        <ChatKit control={chatkit.control} className="chatkit-widget" />
        {(!isReady || errorMessage) && (
          <div className="chatkit-status" role={errorMessage ? "alert" : "status"}>
            <div className="chatkit-status-card">
              <p className="chatkit-status-eyebrow">Propvest ChatKit</p>
              <h1>{errorMessage ? "ChatKit could not start" : "Loading ChatKit..."}</h1>
              <p>{errorMessage ?? "Preparing the conversation interface."}</p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
