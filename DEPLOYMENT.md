# Deployment guide

This guide walks through everything required to deploy the propvest chatbot
to Railway (or any Node.js hosting platform) with correct, secure
configuration.

The chatbot's frontend (`app/components/chatkit-page.tsx`) never calls
OpenAI directly. It calls the server-side endpoint `POST /api/conversation`,
which is the only place that ever holds or uses `OPENAI_API_KEY`. Keeping
all AI calls server-side is what makes this setup safe — the API key never
reaches the browser.

## 1. Required environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `OPENAI_API_KEY` | Yes | Server-only OpenAI API key. Used exclusively by `app/api/conversation/route.ts` to call the OpenAI Responses API. Never exposed to the client. |
| `OPENAI_CHAT_MODEL` | No | Overrides the default model (`gpt-4.1-mini`). Must look like a valid OpenAI chat model name (e.g. `gpt-4.1-mini`, `gpt-4.1`). Invalid values fall back to the default. |
| `OPENAI_CHATKIT_WORKFLOW_ID` | No | Workflow ID for the OpenAI ChatKit widget integration, if used. Server-only. |
| `NEXT_PUBLIC_OPENAI_CHATKIT_DOMAIN_KEY` | No | ChatKit **domain key**, not a secret API key. This is the only credential in this app that is safe to expose to the browser via the `NEXT_PUBLIC_` prefix. |
| `PROPERTY_SEARCH_API_URL` | No (all-or-nothing) | Endpoint for the live property inventory provider. |
| `PROPERTY_SEARCH_API_KEY` | No (all-or-nothing) | Bearer credential sent to the property search provider. Server-only. |
| `PROPERTY_SEARCH_PROVIDER` | No (all-or-nothing) | Display name shown to users for verified listing results. |

Property search is optional, but if you set any one of the three
`PROPERTY_SEARCH_*` variables, you must set all three — otherwise live
inventory search is disabled and a warning is logged at startup.

## 2. Setting environment variables in Railway

1. Open your project in the [Railway dashboard](https://railway.app/dashboard).
2. Select the `propvest-demo` service.
3. Go to the **Variables** tab.
4. Add each variable from the table above as a **raw** key/value pair (do
   not wrap values in quotes).
5. Redeploy the service so the new variables take effect.

The same variables apply to any other Node.js host (Vercel, Render, Fly.io,
etc.) — just use that platform's environment variable UI instead.

## 3. OpenAI setup

1. Sign in at [platform.openai.com](https://platform.openai.com/).
2. Go to **API keys** and create a new secret key:
   https://platform.openai.com/api-keys
3. Copy the key immediately — it is only shown once.
4. Set it as `OPENAI_API_KEY` in your hosting platform. Do **not** commit it
   to source control or put it in a `NEXT_PUBLIC_` variable.
5. (Optional) Set `OPENAI_CHAT_MODEL` if you want to use a model other than
   the default `gpt-4.1-mini`.

## 4. ChatKit domain key configuration (optional)

If you use the OpenAI ChatKit widget (`@openai/chatkit-react`) anywhere in
the app in addition to the custom chat UI:

1. Create a ChatKit workflow at platform.openai.com and note its ID.
2. Set `OPENAI_CHATKIT_WORKFLOW_ID` (server-only) to that workflow ID.
3. Register your production domain to get a **domain key** (this is
   different from your API key and is designed to be public).
4. Set `NEXT_PUBLIC_OPENAI_CHATKIT_DOMAIN_KEY` to that domain key. This is
   the only ChatKit-related value that is safe to expose to the browser.

## 5. Property search provider setup (optional)

Live inventory search is only enabled when all three variables are set:

- `PROPERTY_SEARCH_API_URL` — a POST endpoint that accepts the
  `PropertySearchRequest` shape (see `lib/property-search.ts`) and responds
  with JSON containing `listings` or `results`.
- `PROPERTY_SEARCH_API_KEY` — sent as `Authorization: Bearer <key>`.
- `PROPERTY_SEARCH_PROVIDER` — a display name shown to users, e.g.
  "Acme Listings".

If these are not configured, the assistant still works; it simply tells
users that live inventory search is unavailable instead of returning
listings.

## 6. Verification checklist

Before and after deploying, confirm:

- [ ] `OPENAI_API_KEY` is set on the server (not `NEXT_PUBLIC_OPENAI_API_KEY`).
- [ ] No secret values appear in `.env.example`, source code, or git history.
- [ ] `npm run verify:config` passes locally with your `.env` populated.
- [ ] `npm run build` completes without configuration warnings you didn't
      expect.
- [ ] `POST /api/conversation` returns a valid reply for a simple message
      like `{"messages":[{"role":"user","text":"Hello"}]}`.
- [ ] If property search is configured, a location-specific query returns
      `exactMatches` or `nearbyOpportunities`.
- [ ] Server logs (Railway logs, or your platform's log viewer) never show
      a full API key — only truncated previews like `sk-proj-...wxyz`.

## 7. Security best practices

- **Never hardcode secrets.** All credentials must come from environment
  variables, never from source code.
- **Never use `NEXT_PUBLIC_` for private keys.** Next.js inlines any
  `NEXT_PUBLIC_` variable into the client JavaScript bundle at build time.
  Only `NEXT_PUBLIC_OPENAI_CHATKIT_DOMAIN_KEY` is designed to be public.
- **All AI calls happen server-side.** The frontend only ever calls
  `/api/conversation`; it never talks to `api.openai.com` directly.
- **Logs are safe by default.** Use `safeLog` from `lib/logging.ts` instead
  of `console.log` in server code — it redacts anything that looks like a
  secret and truncates known key patterns.
- **Config is validated at both build time and request time.**
  `scripts/verify-config.ts` runs during `npm run build`, and
  `validateServerConfig()` from `lib/config-validation.ts` runs on every
  request to `/api/conversation`.
- **Error responses stay generic.** Missing configuration returns "The AI
  conversation service is not configured" without naming which variable is
  missing — that detail is only logged server-side.

## 8. Build and test instructions

```bash
# Install dependencies
npm install

# Copy the example environment file and fill in real values
cp .env.example .env

# Verify configuration (also runs automatically before `next build`)
npm run verify:config

# Type-check
npm run typecheck

# Build (runs verify:config first)
npm run build

# Run locally
npm run dev
```

Then test the endpoint:

```bash
curl -X POST http://localhost:3000/api/conversation \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","text":"Looking for a 2 bedroom apartment in Athens"}]}'
```

A healthy response includes a `reply` field and, if property search is
configured and a location was detected, a `properties` field with
`exactMatches`/`nearbyOpportunities`.
