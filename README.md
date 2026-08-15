# Propvest

A Next.js real-estate assistant backed by the OpenAI Responses API and a configured live property-inventory provider. The conversation endpoint validates bounded history, selected locale, retained criteria, and user preferences; it returns a structured AI reply and, when the model has enough search criteria, verified inventory results in the same response.

## Production configuration

Configure these server-only [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables) for both Preview and Production:

- `OPENAI_API_KEY`: API key for the real conversation model.
- `OPENAI_CHAT_MODEL`: optional model override; defaults to `gpt-4.1-mini`.
- `PROPERTY_SEARCH_API_URL`: live inventory search endpoint.
- `PROPERTY_SEARCH_API_KEY`: provider credential sent as a Bearer token.
- `PROPERTY_SEARCH_PROVIDER`: name displayed for verified listing results.

The inventory endpoint receives `location`, `mode`, optional price, bedrooms, bathrooms, area, currency, features, and `allowNearby`. It must respond with `listings` or `results`; each returned listing requires `id`, `title`, `location`, `price`, `currency`, `listingUrl`, and `source`.

No demo replies, generated inventory, placeholder prices, or static fallback answers are returned when a provider is unavailable. The frontend receives structured errors and preserves the conversation so users can retry.

## Deployment

This chatbot requires server-side configuration of OpenAI API credentials.

**Before deploying**, follow the setup in [DEPLOYMENT.md](./DEPLOYMENT.md) to:
1. Get an OpenAI API key
2. Configure environment variables in your hosting platform
3. Run the verification script
4. Test the `/api/conversation` endpoint

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete instructions.

## Validation

```bash
npm run typecheck
npm run verify:config
npm run build
```
