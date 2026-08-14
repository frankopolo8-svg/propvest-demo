"use client";

import { FormEvent, useEffect, useState } from "react";
import { defaultUi, type UiCopy } from "../../lib/ui-copy";
import { GlobalPropertyShowcase } from "./global-property-showcase";

type Listing = { id: string; title: string; location: string; price: number; currency: string; mode: "sale" | "rent"; bedrooms?: number; bathrooms?: number; areaSqm?: number; features?: string[]; imageUrl?: string; listingUrl: string; source: string; retrievedAt: string };
type SearchResponse = { exactMatches: Listing[]; nearbyOpportunities: Listing[]; provider: string; searchedAt: string };
type Criteria = { location?: string; mode?: "sale" | "rent"; maxPrice?: number; minBedrooms?: number; allowNearby?: boolean; propertyType?: string };
type Message = { role: "assistant" | "user"; text: string };
type ConversationResponse = { reply?: string; criteria?: Criteria; ui?: Partial<UiCopy>; error?: string };

export function ChatKitPage() {
  const [draft, setDraft] = useState("");
  const [ui, setUi] = useState<UiCopy>(defaultUi);
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", text: defaultUi.greeting }]);
  const [criteria, setCriteria] = useState<Criteria>({});
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const locale = navigator.language;
    fetch("/api/conversation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "ui", locale }) })
      .then((response) => response.ok ? response.json() as Promise<{ ui?: Partial<UiCopy> }> : undefined)
      .then((result) => { if (result?.ui) setUi((current) => ({ ...current, ...result.ui })); })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!ui.locale) return;
    document.documentElement.lang = ui.locale;
    document.documentElement.dir = /^(ar|fa|he|ur)(-|$)/i.test(ui.locale) ? "rtl" : "ltr";
  }, [ui.locale]);

  async function send(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || loading) return;
    const history = [...messages, { role: "user" as const, text }];
    setDraft(""); setError(null); setMessages(history); setLoading(true);
    try {
      const conversation = await fetch("/api/conversation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: history, criteria }) });
      const turn = await conversation.json() as ConversationResponse;
      if (!conversation.ok || !turn.reply) throw new Error();
      if (turn.ui) setUi((current) => ({ ...current, ...turn.ui }));
      const nextCriteria = mergeCriteria(criteria, turn.criteria ?? {});
      setCriteria(nextCriteria);
      setMessages((current) => [...current, { role: "assistant", text: turn.reply! }]);
      if (!nextCriteria.location) return;
      const response = await fetch("/api/property-search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: nextCriteria.location, mode: nextCriteria.mode ?? "sale", maxPrice: nextCriteria.maxPrice, minBedrooms: nextCriteria.minBedrooms, allowNearby: nextCriteria.allowNearby ?? false }) });
      const body = await response.json() as SearchResponse & { error?: string };
      if (!response.ok) throw new Error();
      setResults(body);
    } catch { setError(ui.requestFailed); }
    finally { setLoading(false); }
  }

  function reset() { setDraft(""); setCriteria({}); setResults(null); setError(null); setMessages([{ role: "assistant", text: ui.greeting }]); }

  return <main className="chatbot-page"><header><a className="brand" href="/"><span>p</span>propvest.</a></header><GlobalPropertyShowcase brief={criteria} copy={ui} />
    <section className="chat-window" id="property-chat"><div className="chat-head"><div><p>{ui.globalPropertyIntelligence}</p><h1>{ui.realEstateExpert}</h1><small>● {ui.hereToHelp}</small></div><button onClick={reset}>{ui.newChat}</button></div>
      <div className="thread" aria-live="polite">{messages.map((message, index) => <div className={`message ${message.role}`} key={`${message.role}-${index}`}><div className="bubble">{message.text}</div></div>)}{loading && <div className="typing"><i/><i/><i/></div>}{error && <p className="search-error" role="alert">{error}</p>}{results && <SearchResults results={results} copy={ui} />}</div>
      <div className="chat-suggestions" aria-label={ui.suggestedPrompts}>{ui.suggestions.map((suggestion) => <button key={suggestion} onClick={() => setDraft(suggestion)}>{suggestion}</button>)}</div>
      <form className="chat-composer" onSubmit={send}><label><span>✦</span><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={ui.input} aria-label={ui.propertyRequest} /></label>{draft && <button className="clear-draft" type="button" onClick={() => setDraft("")}>{ui.clear}</button>}<button type="submit" disabled={loading}>{loading ? "…" : ui.send}</button></form><p className="disclaimer">{ui.liveDisclaimer}</p>
    </section>
  </main>;
}

function SearchResults({ results, copy }: { results: SearchResponse; copy: UiCopy }) {
  const hasResults = results.exactMatches.length > 0 || results.nearbyOpportunities.length > 0;
  const time = new Date(results.searchedAt).toLocaleString(copy.locale);
  const intro = hasResults ? format(copy.verifiedResults, { provider: results.provider, time }) : copy.noResults;
  return <section className="recommendation"><div className="recommendation-intro"><p>{intro}</p></div><ListingGroup title={copy.exactMatches} listings={results.exactMatches} copy={copy} /><ListingGroup title={copy.nearbyAlternatives} listings={results.nearbyOpportunities} copy={copy} /></section>;
}
function ListingGroup({ title, listings, copy }: { title: string; listings: Listing[]; copy: UiCopy }) { if (!listings.length) return null; return <section className="listing-group"><h2>{title}</h2><div className="listing-grid">{listings.map((listing) => <article className="listing-card" key={`${listing.source}-${listing.id}`}>{listing.imageUrl && <img src={listing.imageUrl} alt="" />}<p>{listing.location}</p><h3>{listing.title}</h3><strong>{new Intl.NumberFormat(copy.locale, { style: "currency", currency: listing.currency, maximumFractionDigits: 0 }).format(listing.price)}{listing.mode === "rent" ? ` ${copy.rentPerMonth}` : ""}</strong><small>{[listing.bedrooms && `${listing.bedrooms} ${copy.beds}`, listing.bathrooms && `${listing.bathrooms} ${copy.baths}`, listing.areaSqm && `${listing.areaSqm} m²`].filter(Boolean).join(" · ")}</small>{!!listing.features?.length && <p>{listing.features.slice(0, 4).join(" · ")}</p>}<small>{format(copy.retrievedFrom, { source: listing.source, time: new Date(listing.retrievedAt).toLocaleString(copy.locale) })}</small><a href={listing.listingUrl} target="_blank" rel="noreferrer">{copy.verifyListing}</a></article>)}</div></section>; }
function format(template: string, values: Record<string, string>) { return template.replace(/\{(provider|source|time)\}/g, (_, key: string) => values[key] ?? ""); }
function mergeCriteria(current: Criteria, update: Criteria): Criteria { return Object.assign({}, current, ...Object.entries(update).filter(([, value]) => value !== undefined && value !== "").map(([key, value]) => ({ [key]: value }))) as Criteria; }
