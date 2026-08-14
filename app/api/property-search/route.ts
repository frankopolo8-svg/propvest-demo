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
  const criteria = await request.json().catch(() => null) as PropertySearchRequest | null;
  if (!criteria?.location?.trim() || (criteria.mode !== "sale" && criteria.mode !== "rent")) {
    return NextResponse.json({ error: "Location and search mode are required." }, { status: 400 });
  }

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
