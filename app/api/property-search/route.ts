import { NextResponse } from "next/server";
import {
  PropertySearchConfigurationError,
  PropertySearchProviderError,
  type PropertySearchRequest,
  searchVerifiedListings,
} from "../../../lib/property-search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const criteria = parseCriteria(await request.json().catch(() => null));
  if (!criteria) return NextResponse.json({ error: "Location and search mode are required." }, { status: 400 });

  try {
    return NextResponse.json(await searchVerifiedListings(criteria), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof PropertySearchConfigurationError) {
      return NextResponse.json(
        { error: "Live property search is unavailable until a listing provider is configured." },
        { status: 503 },
      );
    }
    if (error instanceof PropertySearchProviderError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    return NextResponse.json({ error: "Property search failed. Please try again." }, { status: 502 });
  }
}

function parseCriteria(value: unknown): PropertySearchRequest | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const location = typeof input.location === "string" ? input.location.trim() : "";
  if (!location || (input.mode !== "sale" && input.mode !== "rent")) return null;

  return {
    location,
    mode: input.mode,
    currency: string(input.currency),
    minPrice: number(input.minPrice),
    maxPrice: number(input.maxPrice),
    minBedrooms: number(input.minBedrooms),
    minBathrooms: number(input.minBathrooms),
    minAreaSqm: number(input.minAreaSqm),
    features: Array.isArray(input.features) ? input.features.filter((feature): feature is string => typeof feature === "string") : undefined,
    allowNearby: input.allowNearby === true ? true : undefined,
  };
}

function string(value: unknown) { return typeof value === "string" && value.trim() ? value.trim() : undefined; }
function number(value: unknown) { return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined; }
