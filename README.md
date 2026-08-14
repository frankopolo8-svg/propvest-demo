# Propvest

A Next.js property-search UI that displays only listings retrieved from a configured external provider. It does not ship demo inventory, fabricated asking prices, or inferred availability.

## Configure live inventory

Set these server-only variables in [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables):

- `PROPERTY_SEARCH_API_URL`: provider search endpoint; receives a `POST` request.
- `PROPERTY_SEARCH_API_KEY`: provider credential; sent as a Bearer token.
- `PROPERTY_SEARCH_PROVIDER`: source label shown beside retrieved listings.

The provider request body contains `location`, `mode`, optional price/bedroom/bathroom/area constraints, requested features, and `allowNearby`. The response must return either `listings` or `results`; every usable item requires `id`, `title`, `location`, `price`, `currency`, `listingUrl`, and `source`. Optional normalizations include `beds`/`bedrooms`, `baths`/`bathrooms`, `sqm`/`areaSqm`, `imageUrl`, and `features`.

The server endpoint strictly filters hard requirements, deduplicates listings by source and listing ID, ranks matches, and returns exact matches separately from nearby opportunities. Prices remain provider-supplied values and each card links to the source for final verification.

## Development

```bash
npm install
npm run typecheck
npm run build
```
