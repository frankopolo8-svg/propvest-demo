"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { defaultUi, type UiCopy } from "../../lib/ui-copy";
import { GlobalPropertyShowcase } from "./global-property-showcase";

type Listing = { id: string; title: string; location: string; price: number; currency: string; mode: "sale" | "rent"; bedrooms?: number; bathrooms?: number; areaSqm?: number; features?: string[]; imageUrl?: string; listingUrl: string; source: string; retrievedAt: string };
type SearchResponse = { exactMatches: Listing[]; nearbyOpportunities: Listing[]; provider: string; searchedAt: string };
type Criteria = { location?: string; mode?: "sale" | "rent"; maxPrice?: number; minBedrooms?: number; allowNearby?: boolean; propertyType?: string };
type Message = { role: "assistant" | "user"; text: string };
type SpeechRecognitionEventLike = { results: ArrayLike<ArrayLike<{ transcript: string }>> };
type SpeechRecognitionInstance = { lang: string; continuous: boolean; interimResults: boolean; start(): void; stop(): void; onresult: ((event: SpeechRecognitionEventLike) => void) | null; onend: (() => void) | null; onerror: (() => void) | null; };
type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;
declare global { interface Window { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor; } }

export function ChatKitPage() {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", text: defaultUi.greeting }]);
  const [criteria, setCriteria] = useState<Criteria>({});
  const [ui, setUi] = useState<UiCopy>(defaultUi);
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dictating, setDictating] = useState(false);
  const recognition = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => {
    if (!ui.locale) return;
    document.documentElement.lang = ui.locale;
    document.documentElement.dir = /^(ar|fa|he|ur)(-|$)/i.test(ui.locale) ? "rtl" : "ltr";
  }, [ui.locale]);

  function toggleDictation() {
    if (recognition.current) { recognition.current.stop(); return; }
    const SpeechRecognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const instance = new SpeechRecognition();
    instance.lang = ui.locale || navigator.language; instance.continuous = false; instance.interimResults = false;
    instance.onresult = (event) => setDraft((current) => `${current}${current ? " " : ""}${event.results[event.results.length - 1][0].transcript}`);
    instance.onend = () => { recognition.current = null; setDictating(false); };
    instance.onerror = () => { recognition.current = null; setDictating(false); };
    recognition.current = instance; setDictating(true); instance.start();
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || loading) return;
    const history = [...messages, { role: "user" as const, text }];
    setDraft(""); setError(null); setMessages(history); setLoading(true);
    try {
      const conversation = await fetch("/api/conversation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: history, criteria }) });
      const turn = await conversation.json() as { reply?: string; criteria?: Criteria; ui?: Partial<UiCopy>; error?: string };
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
      <div className="thread" aria-live="polite">{messages.map((message, index) => <div className={`message ${message.role}`} key={`${message.role}-${index}`}><div className="bubble">{message.text}</div></div>)}{loading && <div className="typing"><i/><i/><i/></div>}{error && <p className="search-error" role="alert">{error}</p>}{results && <SearchResults results={results} />}</div>
      <div className="chat-suggestions" aria-label={ui.suggestedPrompts}>{ui.suggestions.map((suggestion) => <button key={suggestion} onClick={() => setDraft(suggestion)}>{suggestion}</button>)}</div>
      <form className="chat-composer" onSubmit={send}><label><span>✦</span><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={ui.input} aria-label={ui.propertyRequest} /></label><button className={`dictation ${dictating ? "active" : ""}`} type="button" onClick={toggleDictation} aria-label={dictating ? ui.stopDictation : ui.startDictation}>⌁</button>{draft && <button className="clear-draft" type="button" onClick={() => setDraft("")}>{ui.clear}</button>}<button type="submit" disabled={loading}>{loading ? "…" : ui.send}</button></form><p className="disclaimer">{ui.liveDisclaimer}</p>
    </section>
  </main>;
}

function SearchResults({ results }: { results: SearchResponse }) {
  const hasResults = results.exactMatches.length > 0 || results.nearbyOpportunities.length > 0;
  return <section className="recommendation"><div className="recommendation-intro"><p>{hasResults ? `Verified results from ${results.provider}, retrieved ${new Date(results.searchedAt).toLocaleString()}.` : "No verified listing met the current brief."}</p></div><ListingGroup title="Exact matches" listings={results.exactMatches} /><ListingGroup title="Nearby alternatives" listings={results.nearbyOpportunities} /></section>;
}
function ListingGroup({ title, listings }: { title: string; listings: Listing[] }) { if (!listings.length) return null; return <section className="listing-group"><h2>{title}</h2><div className="listing-grid">{listings.map((listing) => <article className="listing-card" key={`${listing.source}-${listing.id}`}>{listing.imageUrl && <img src={listing.imageUrl} alt="" />}<p>{listing.location}</p><h3>{listing.title}</h3><strong>{new Intl.NumberFormat(undefined, { style: "currency", currency: listing.currency, maximumFractionDigits: 0 }).format(listing.price)}{listing.mode === "rent" ? " / month" : ""}</strong><small>{[listing.bedrooms && `${listing.bedrooms} beds`, listing.bathrooms && `${listing.bathrooms} baths`, listing.areaSqm && `${listing.areaSqm} m²`].filter(Boolean).join(" · ")}</small>{!!listing.features?.length && <p>{listing.features.slice(0, 4).join(" · ")}</p>}<small>Retrieved from {listing.source} · {new Date(listing.retrievedAt).toLocaleString()}</small><a href={listing.listingUrl} target="_blank" rel="noreferrer">Verify listing and availability</a></article>)}</div></section>; }
function mergeCriteria(current: Criteria, update: Criteria): Criteria { return Object.assign({}, current, ...Object.entries(update).filter(([, value]) => value !== undefined && value !== "").map(([key, value]) => ({ [key]: value }))) as Criteria; }
