import { NextResponse } from "next/server";
import { PropertySearchConfigurationError, PropertySearchProviderError, type PropertySearchRequest, searchVerifiedListings } from "../../../lib/property-search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DemoRequest = PropertySearchRequest & { locale?: string; propertyType?: string };
type DemoListing = { id: string; title: string; location: string; price: number; currency: string; mode: "sale" | "rent"; bedrooms: number; bathrooms: number; areaSqm: number; features: string[]; imageUrl: string; listingUrl: string; source: string; retrievedAt: string };

export async function POST(request: Request) {
  const criteria = parseCriteria(await request.json().catch(() => null));
  if (!criteria) return NextResponse.json({ error: "Location and search mode are required." }, { status: 400 });
  try {
    return NextResponse.json(await searchVerifiedListings(criteria), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof PropertySearchConfigurationError || error instanceof PropertySearchProviderError) {
      return NextResponse.json(demoResults(criteria), { headers: { "Cache-Control": "no-store", "X-Propvest-Mode": "illustrative-demo" } });
    }
    return NextResponse.json({ error: "Property search failed. Please try again." }, { status: 502 });
  }
}

function parseCriteria(value: unknown): DemoRequest | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const location = typeof input.location === "string" ? input.location.trim() : "";
  if (!location || (input.mode !== "sale" && input.mode !== "rent")) return null;
  return { location, mode: input.mode, maxPrice: number(input.maxPrice), minBedrooms: number(input.minBedrooms), propertyType: typeof input.propertyType === "string" ? input.propertyType.trim().slice(0, 100) || undefined : undefined, allowNearby: input.allowNearby === true, locale: typeof input.locale === "string" ? input.locale : undefined };
}
function number(value: unknown) { return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined; }
function demoResults(criteria: DemoRequest) {
  const cap = criteria.maxPrice || 750_000;
  const ratios = [0.62, 0.78, 0.9, 0.98, 1.08, 1.16];
  const labels = demoLabels(criteria.locale);
  const images = ["photo-1600585154340-be6161a56a0c", "photo-1600607687920-4e2a09cf159d", "photo-1510798831971-661eb04b3739", "photo-1497366811353-6870744d04b2", "photo-1449158743715-0a90ebb6d2d8", "photo-1564013799919-ab600027ffc6"];
  const listings: DemoListing[] = ratios.map((ratio, index) => ({ id: `demo-${index + 1}`, title: `${labels[index]} · ${criteria.propertyType || "Investment residence"}`, location: criteria.location, price: Math.max(35_000, Math.round(cap * ratio)), currency: "EUR", mode: criteria.mode, bedrooms: Math.max(criteria.minBedrooms || 1, 1 + (index % 4)), bathrooms: 1 + (index % 3), areaSqm: 55 + index * 28, features: ["Illustrative demo", index % 2 ? "Flexible layout" : "Strong rental potential", index > 3 ? "Premium finish" : "Local character"], imageUrl: `https://images.unsplash.com/${images[index]}?auto=format&fit=crop&w=1200&q=85`, listingUrl: "https://example.invalid/illustrative-property", source: "Illustrative demo inventory", retrievedAt: new Date().toISOString() }));
  return { exactMatches: listings, nearbyOpportunities: [], provider: "Illustrative demo inventory", searchedAt: new Date().toISOString(), illustrative: true };
}

function demoLabels(locale?: string) { const lang = (locale || "en").split("-")[0]; return ({ el: ["Καλύτερη επιλογή", "Καλύτερη αξία", "Οικονομική επιλογή", "Μεγαλύτερη επιλογή", "Premium επιλογή", "Εναλλακτικό στυλ"], es: ["Mejor opción", "Mejor valor", "Opción económica", "Opción más amplia", "Opción premium", "Estilo alternativo"], fr: ["Meilleure option", "Meilleur rapport qualité-prix", "Option économique", "Option plus spacieuse", "Option premium", "Style alternatif"], de: ["Beste Wahl", "Bestes Preis-Leistungs-Verhältnis", "Günstige Option", "Größere Option", "Premium-Option", "Alternativer Stil"], it: ["Migliore scelta", "Miglior valore", "Opzione economica", "Opzione più ampia", "Opzione premium", "Stile alternativo"], ar: ["أفضل خيار", "أفضل قيمة", "خيار اقتصادي", "خيار أكبر", "خيار مميز", "نمط بديل"] } as Record<string, string[]>)[lang] || ["Best Match", "Best Value", "Budget Option", "Larger Option", "Premium Option", "Alternative Style"]; }
