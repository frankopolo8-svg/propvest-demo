"use client";

import { useMemo } from "react";
import { ChatKit, useChatKit } from "@openai/chatkit-react";

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
  const api = useMemo(() => ({ getClientSecret }), []);
  const chatkit = useChatKit({ api });

  return (
    <main className="chatkit-shell">
      <div className="chatkit-frame">
        <ChatKit control={chatkit.control} className="chatkit-widget" />
      </div>
    </main>
  );
}
