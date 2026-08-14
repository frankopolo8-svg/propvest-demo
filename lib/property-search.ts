export type PropertySearchRequest = {
  location: string;
  mode: "sale" | "rent";
  currency?: string;
  minPrice?: number;
  maxPrice?: number;
  minBedrooms?: number;
  minBathrooms?: number;
  minAreaSqm?: number;
  features?: string[];
  allowNearby?: boolean;
};

export type VerifiedListing = {
  id: string;
  title: string;
  location: string;
  price: number;
  currency: string;
  mode: "sale" | "rent";
  bedrooms?: number;
  bathrooms?: number;
  areaSqm?: number;
  features?: string[];
  imageUrl?: string;
  listingUrl: string;
  source: string;
  retrievedAt: string;
  verificationStatus: "retrieved";
};

export type PropertySearchResponse = {
  exactMatches: VerifiedListing[];
  nearbyOpportunities: VerifiedListing[];
  provider: string;
  searchedAt: string;
};

type ProviderResponse = { listings?: unknown[]; results?: unknown[] };

export async function searchVerifiedListings(
  criteria: PropertySearchRequest,
): Promise<PropertySearchResponse> {
  const endpoint = process.env.PROPERTY_SEARCH_API_URL;
  const apiKey = process.env.PROPERTY_SEARCH_API_KEY;
  const provider = process.env.PROPERTY_SEARCH_PROVIDER || "Configured property provider";

  if (!endpoint || !apiKey) {
    throw new PropertySearchConfigurationError();
  }

  const upstream = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(criteria),
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });

  if (!upstream.ok) {
    throw new PropertySearchProviderError(`The listing provider returned ${upstream.status}.`);
  }

  const payload = (await upstream.json()) as ProviderResponse;
  const rawListings = payload.listings ?? payload.results;
  if (!Array.isArray(rawListings)) {
    throw new PropertySearchProviderError("The listing provider returned an unsupported response.");
  }

  const listings = rawListings
    .map(normalizeListing)
    .filter((listing): listing is VerifiedListing => listing !== null)
    .filter((listing) => matchesHardRequirements(listing, criteria))
    .filter(uniqueBy((listing) => `${listing.source}:${listing.id}`))
    .sort((a, b) => score(b, criteria) - score(a, criteria));

  const exactMatches = listings.filter((listing) => sameLocation(listing.location, criteria.location));
  const nearbyOpportunities = criteria.allowNearby
    ? listings.filter((listing) => !sameLocation(listing.location, criteria.location))
    : [];

  return { exactMatches, nearbyOpportunities, provider, searchedAt: new Date().toISOString() };
}

function normalizeListing(value: unknown): VerifiedListing | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const id = string(item.id ?? item.listingId);
  const title = string(item.title ?? item.name);
  const location = string(item.location ?? item.address ?? item.city);
  const price = number(item.price ?? item.listPrice);
  const currency = string(item.currency).toUpperCase() || "EUR";
  const mode = item.mode === "rent" || item.transactionType === "rent" ? "rent" : "sale";
  const listingUrl = string(item.listingUrl ?? item.url ?? item.sourceUrl);
  const source = string(item.source ?? item.provider);

  if (!id || !title || !location || price === null || !isCurrencyCode(currency) || !isHttpUrl(listingUrl) || !source) return null;

  return {
    id,
    title,
    location,
    price,
    currency,
    mode,
    bedrooms: optionalNumber(item.bedrooms ?? item.beds),
    bathrooms: optionalNumber(item.bathrooms ?? item.baths),
    areaSqm: optionalNumber(item.areaSqm ?? item.sqm ?? item.area),
    features: Array.isArray(item.features) ? item.features.filter((feature): feature is string => typeof feature === "string") : [],
    imageUrl: string(item.imageUrl ?? item.image) || undefined,
    listingUrl,
    source,
    retrievedAt: new Date().toISOString(),
    verificationStatus: "retrieved",
  };
}

function matchesHardRequirements(listing: VerifiedListing, criteria: PropertySearchRequest) {
  return listing.mode === criteria.mode
    && (!criteria.minPrice || listing.price >= criteria.minPrice)
    && (!criteria.maxPrice || listing.price <= criteria.maxPrice)
    && (!criteria.minBedrooms || (listing.bedrooms ?? 0) >= criteria.minBedrooms)
    && (!criteria.minBathrooms || (listing.bathrooms ?? 0) >= criteria.minBathrooms)
    && (!criteria.minAreaSqm || (listing.areaSqm ?? 0) >= criteria.minAreaSqm)
    && (!criteria.currency || listing.currency === criteria.currency);
}

function score(listing: VerifiedListing, criteria: PropertySearchRequest) {
  const budgetFit = criteria.maxPrice ? Math.max(0, 100 - ((criteria.maxPrice - listing.price) / criteria.maxPrice) * 100) : 50;
  const featureFit = (criteria.features ?? []).filter((feature) =>
    listing.features?.some((listingFeature) => listingFeature.toLowerCase().includes(feature.toLowerCase())),
  ).length * 20;
  return budgetFit + featureFit + (listing.bedrooms ?? 0) + (listing.areaSqm ?? 0) / 100;
}

function sameLocation(candidate: string, requested: string) {
  return candidate.toLocaleLowerCase().includes(requested.trim().toLocaleLowerCase());
}

function uniqueBy<T>(key: (value: T) => string) {
  const seen = new Set<string>();
  return (value: T) => !seen.has(key(value)) && (seen.add(key(value)), true);
}

function string(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function isCurrencyCode(value: string) { return /^[A-Z]{3}$/.test(value); }
function isHttpUrl(value: string) {
  try { const url = new URL(value); return url.protocol === "https:" || url.protocol === "http:"; } catch { return false; }
}
function number(value: unknown) { return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null; }
function optionalNumber(value: unknown) { return number(value) ?? undefined; }

export class PropertySearchConfigurationError extends Error {
  constructor() { super("Property search is not configured."); }
}

export class PropertySearchProviderError extends Error {}
