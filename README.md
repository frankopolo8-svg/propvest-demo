# Propvest Demo

Single Next.js application for a full-page OpenAI ChatKit demo, deployable directly on Vercel.

## Required environment variables

- `OPENAI_API_KEY` - server-only OpenAI API key. Never expose this with a `NEXT_PUBLIC_` prefix.
- `OPENAI_CHATKIT_WORKFLOW_ID` - ChatKit workflow ID used when creating sessions.

## Development

```bash
npm install
npm run dev
```

Open http://localhost:3000. The app creates ChatKit sessions through `POST /api/chatkit/session`.
