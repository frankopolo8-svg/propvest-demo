"use client";

import { FormEvent, useState } from "react";

type Listing = {
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

type SearchResponse = {
  exactMatches: Listing[];
  nearbyOpportunities: Listing[];
  provider: string;
  searchedAt: string;
};

export function ChatKitPage() {
  const [location, setLocation] = useState("");
  const [mode, setMode] = useState<"sale" | "rent">("sale");
  const [maxPrice, setMaxPrice] = useState("");
  const [minBedrooms, setMinBedrooms] = useState("");
  const [allowNearby, setAllowNearby] = useState(true);
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function search(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      const response = await fetch("/api/property-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location,
          mode,
          maxPrice: maxPrice ? Number(maxPrice) : undefined,
          minBedrooms: minBedrooms ? Number(minBedrooms) : undefined,
          allowNearby,
        }),
      });
      const body = await response.json() as SearchResponse & { error?: string };
      if (!response.ok) throw new Error(body.error || "Property search failed.");
      setResults(body);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Property search failed.");
    } finally {
      setLoading(false);
    }
  }

  return <main className="chatbot-page">
    <header><a className="brand" href="/"><span>p</span>propvest.</a></header>
    <section className="chat-window" id="property-search">
      <div className="chat-head"><div><p>Global property intelligence</p><h1>Real Estate Expert</h1><small>Verified listings only</small></div></div>
      <div className="thread">
        <div className="message assistant"><div className="bubble"><strong>Search live inventory worldwide</strong><p>Results are retrieved from the configured listing provider, filtered against your requirements, deduplicated, and ranked. No demo listings or estimated asking prices are shown.</p></div></div>
        <form className="property-search-form" onSubmit={search}>
          <label>Location<input required value={location} onChange={(event) => setLocation(event.target.value)} placeholder="City, village, region, or country" /></label>
          <label>Purpose<select value={mode} onChange={(event) => setMode(event.target.value as "sale" | "rent")}><option value="sale">Buy</option><option value="rent">Rent</option></select></label>
          <label>Maximum price<input min="0" inputMode="numeric" type="number" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} placeholder="Optional" /></label>
          <label>Minimum bedrooms<input min="0" inputMode="numeric" type="number" value={minBedrooms} onChange={(event) => setMinBedrooms(event.target.value)} placeholder="Optional" /></label>
          <label className="nearby"><input type="checkbox" checked={allowNearby} onChange={(event) => setAllowNearby(event.target.checked)} /> Include nearby opportunities when exact inventory is limited</label>
          <button type="submit" disabled={loading}>{loading ? "Searching verified inventory…" : "Search live listings"}</button>
        </form>
        {error && <p className="search-error" role="alert">{error}</p>}
        {results && <SearchResults results={results} />}
      </div>
      <p className="disclaimer">Asking prices and availability are displayed only from retrieved provider data. Verify details with the original listing source before advising or contacting a seller.</p>
    </section>
  </main>;
}

function SearchResults({ results }: { results: SearchResponse }) {
  const hasResults = results.exactMatches.length > 0 || results.nearbyOpportunities.length > 0;
  return <section className="recommendation" aria-live="polite">
    <div className="recommendation-intro"><p>{hasResults ? `Retrieved from ${results.provider} at ${new Date(results.searchedAt).toLocaleString()}.` : "No verified listings met the current criteria."}</p></div>
    <ListingGroup title="Exact matches" listings={results.exactMatches} />
    <ListingGroup title="Nearby opportunities" listings={results.nearbyOpportunities} />
  </section>;
}

function ListingGroup({ title, listings }: { title: string; listings: Listing[] }) {
  if (!listings.length) return null;
  return <section className="listing-group"><h2>{title}</h2><div className="listing-grid">{listings.map((listing) => <article className="listing-card" key={`${listing.source}-${listing.id}`}>
    {listing.imageUrl && <img src={listing.imageUrl} alt="" />}
    <p>{listing.location}</p><h3>{listing.title}</h3><strong>{new Intl.NumberFormat(undefined, { style: "currency", currency: listing.currency, maximumFractionDigits: 0 }).format(listing.price)}{listing.mode === "rent" ? " / month" : ""}</strong>
    <small>{[listing.bedrooms && `${listing.bedrooms} beds`, listing.bathrooms && `${listing.bathrooms} baths`, listing.areaSqm && `${listing.areaSqm} m²`].filter(Boolean).join(" · ")}</small>
    {!!listing.features?.length && <p>{listing.features.slice(0, 4).join(" · ")}</p>}
    <small>Retrieved from {listing.source} · {new Date(listing.retrievedAt).toLocaleString()}</small>
    <a href={listing.listingUrl} target="_blank" rel="noreferrer">Verify listing and availability</a>
  </article>)}</div></section>;
}
