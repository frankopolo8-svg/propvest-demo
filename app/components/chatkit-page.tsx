"use client";

import { FormEvent, useState } from "react";
import { GlobalPropertyShowcase } from "./global-property-showcase";

type Listing = { id: string; title: string; location: string; price: number; currency: string; mode: "sale" | "rent"; bedrooms?: number; bathrooms?: number; areaSqm?: number; features?: string[]; imageUrl?: string; listingUrl: string; source: string; retrievedAt: string; verificationStatus: "retrieved" };
type SearchResponse = { exactMatches: Listing[]; nearbyOpportunities: Listing[]; provider: string; searchedAt: string };
type Message = { role: "assistant" | "user"; text: string };
type SearchCriteria = { location: string; mode: "sale" | "rent"; maxPrice?: number; minBedrooms?: number; allowNearby: boolean };

const suggestions = ["Apartments in Barcelona under €350,000", "Luxury villas in Mykonos", "Affordable village homes in Italy", "Family homes near the beach", "Investment properties worldwide"];

export function ChatKitPage() {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", text: "Hello, I’m your real estate assistant. Tell me where and how you’d like to live, in your own words. I’ll help you refine the brief and check verified inventory when I have enough detail." }]);
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function send(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || loading) return;
    setDraft("");
    setMessages((current) => [...current, { role: "user", text }]);
    setError(null);
    const criteria = parseRequest(text);
    if (!criteria) {
      setMessages((current) => [...current, { role: "assistant", text: "I can help with that. Which city, town, village, region, or country should I focus on? You can also mention whether you want to buy or rent, your budget, and bedrooms." }]);
      return;
    }

    setLoading(true);
    setMessages((current) => [...current, { role: "assistant", text: `I’m checking verified ${criteria.mode === "rent" ? "rental" : "sale"} inventory in ${criteria.location}.` }]);
    try {
      const response = await fetch("/api/property-search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(criteria) });
      const body = await response.json() as SearchResponse & { error?: string };
      if (!response.ok) throw new Error(body.error || "Property search failed.");
      setResults(body);
      const count = body.exactMatches.length + body.nearbyOpportunities.length;
      setMessages((current) => [...current, { role: "assistant", text: count ? `I found ${count} verified option${count === 1 ? "" : "s"}. Exact matches and clearly labeled nearby alternatives are shown below as support for our conversation.` : `I didn’t find a verified match for that brief yet. We can keep the location exact, adjust the budget or requirements, or—if you want—consider nearby areas.` }]);
    } catch (searchError) {
      const message = searchError instanceof Error ? searchError.message : "Property search failed.";
      setError(message);
      setMessages((current) => [...current, { role: "assistant", text: "I couldn’t retrieve live inventory right now. I haven’t substituted demo properties for live results; we can refine your brief or try again when a provider is available." }]);
    } finally { setLoading(false); }
  }

  function reset() {
    setDraft(""); setResults(null); setError(null); setLoading(false);
    setMessages([{ role: "assistant", text: "New conversation started. Tell me what kind of place you’re looking for and where in the world you’d like to focus." }]);
  }

  return <main className="chatbot-page">
    <header><a className="brand" href="/"><span>p</span>propvest.</a></header>
    <GlobalPropertyShowcase />
    <section className="chat-window" id="property-chat">
      <div className="chat-head"><div><p>Global property intelligence</p><h1>Real Estate Expert</h1><small>● Here to help</small></div><button onClick={reset}>New chat</button></div>
      <div className="thread" aria-live="polite">{messages.map((message, index) => <div className={`message ${message.role}`} key={`${message.role}-${index}`}><div className="bubble">{message.text}</div></div>)}{loading && <div className="typing"><i/><i/><i/></div>}{error && <p className="search-error" role="alert">{error}</p>}{results && <SearchResults results={results} />}</div>
      <div className="chat-suggestions" aria-label="Suggested prompts">{suggestions.map((suggestion) => <button key={suggestion} onClick={() => setDraft(suggestion)}>{suggestion}</button>)}</div>
      <form className="chat-composer" onSubmit={send}><label><span>✦</span><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Tell me what you’re looking for…" aria-label="Property request" /></label>{draft && <button className="clear-draft" type="button" onClick={() => setDraft("")}>Clear</button>}<button type="submit" disabled={loading}>{loading ? "…" : "Send"}</button></form>
      <p className="disclaimer">Live results are retrieved from the configured provider. The surrounding gallery is illustrative demo material only.</p>
    </section>
  </main>;
}

function SearchResults({ results }: { results: SearchResponse }) {
  const hasResults = results.exactMatches.length > 0 || results.nearbyOpportunities.length > 0;
  return <section className="recommendation"><div className="recommendation-intro"><p>{hasResults ? `Verified results from ${results.provider}, retrieved ${new Date(results.searchedAt).toLocaleString()}.` : "No verified listing met the current brief."}</p></div><ListingGroup title="Exact matches" listings={results.exactMatches} /><ListingGroup title="Nearby opportunities" listings={results.nearbyOpportunities} /></section>;
}

function ListingGroup({ title, listings }: { title: string; listings: Listing[] }) {
  if (!listings.length) return null;
  return <section className="listing-group"><h2>{title}</h2><div className="listing-grid">{listings.map((listing) => <article className="listing-card" key={`${listing.source}-${listing.id}`}>{listing.imageUrl && <img src={listing.imageUrl} alt="" />}<p>{listing.location}</p><h3>{listing.title}</h3><strong>{new Intl.NumberFormat(undefined, { style: "currency", currency: listing.currency, maximumFractionDigits: 0 }).format(listing.price)}{listing.mode === "rent" ? " / month" : ""}</strong><small>{[listing.bedrooms && `${listing.bedrooms} beds`, listing.bathrooms && `${listing.bathrooms} baths`, listing.areaSqm && `${listing.areaSqm} m²`].filter(Boolean).join(" · ")}</small>{!!listing.features?.length && <p>{listing.features.slice(0, 4).join(" · ")}</p>}<small>Retrieved from {listing.source} · {new Date(listing.retrievedAt).toLocaleString()}</small><a href={listing.listingUrl} target="_blank" rel="noreferrer">Verify listing and availability</a></article>)}</div></section>;
}

function parseRequest(text: string): SearchCriteria | null {
  const location = locationFrom(text);
  if (!location) return null;
  const amount = text.match(/(?:€|\$|£|AED\s?|USD\s?|EUR\s?)([\d,.]+)\s*([km])?/i);
  const numericPrice = amount ? Number(amount[1].replace(/,/g, "")) * (amount[2]?.toLowerCase() === "m" ? 1_000_000 : amount[2]?.toLowerCase() === "k" ? 1_000 : 1) : undefined;
  const beds = text.match(/(\d+)\s*(?:bed(?:room)?s?|br\b)/i);
  return { location, mode: /\b(rent|rental|lease|per month)\b/i.test(text) ? "rent" : "sale", maxPrice: numericPrice, minBedrooms: beds ? Number(beds[1]) : undefined, allowNearby: /\b(nearby|near|around|surrounding)\b/i.test(text) };
}

function locationFrom(text: string) {
  const match = text.match(/\b(?:in|near|around|at)\s+([\p{L}][\p{L}\s'’.-]{1,70}?)(?=\s+(?:under|below|for|with|budget|and|from)\b|[,.!?]|$)/iu);
  const location = match?.[1].trim() || "";
  return /^(?:the )?(?:beach|sea|city|mountains?|countryside|worldwide)$/i.test(location) ? "" : location;
}
