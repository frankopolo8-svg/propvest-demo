"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { defaultUi, type UiCopy } from "../../lib/ui-copy";
import { GlobalPropertyShowcase } from "./global-property-showcase";

type Listing = { id: string; title: string; location: string; price: number; currency: string; mode: "sale" | "rent"; bedrooms?: number; bathrooms?: number; areaSqm?: number; features?: string[]; imageUrl?: string; listingUrl: string; source: string; retrievedAt: string };
type SearchResponse = { exactMatches: Listing[]; nearbyOpportunities: Listing[]; provider: string; searchedAt: string; illustrative?: boolean };
type Criteria = { location?: string; mode?: "sale" | "rent"; maxPrice?: number; minBedrooms?: number; allowNearby?: boolean; propertyType?: string };
type Message = { role: "assistant" | "user"; text: string };
type SpeechRecognitionEventLike = { results: ArrayLike<ArrayLike<{ transcript: string }>> };
type SpeechRecognitionInstance = { lang: string; continuous: boolean; interimResults: boolean; start(): void; stop(): void; onresult: ((event: SpeechRecognitionEventLike) => void) | null; onend: (() => void) | null; onerror: (() => void) | null; };
type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;
const languages = [{ code: "el", label: "Ελληνικά" }, { code: "en", label: "English" }, { code: "es", label: "Español" }, { code: "fr", label: "Français" }, { code: "de", label: "Deutsch" }, { code: "it", label: "Italiano" }, { code: "pt", label: "Português" }, { code: "tr", label: "Türkçe" }, { code: "ar", label: "العربية" }, { code: "zh", label: "中文" }, { code: "ja", label: "日本語" }];
const languageStorageKey = "propvest-language";
declare global { interface Window { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor; } }

export function ChatKitPage() {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", text: defaultUi.greeting }]);
  const [criteria, setCriteria] = useState<Criteria>({});
  const [ui, setUi] = useState<UiCopy>(defaultUi);
  const [locale, setLocale] = useState("en");
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastMessage, setLastMessage] = useState<Message | null>(null);
  const [dictating, setDictating] = useState(false);
  const recognition = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(languageStorageKey);
    const preferred = stored || navigator.language || "en";
    setLocale(languages.some((language) => language.code === preferred) ? preferred : preferred.split("-")[0]);
  }, []);

  useEffect(() => {
    fetch("/api/conversation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "ui", locale }) })
      .then((response) => response.ok ? response.json() as Promise<{ ui?: Partial<UiCopy> }> : undefined)
      .then((result) => { if (result?.ui) setUi((current) => ({ ...current, ...result.ui, locale })); })
      .catch(() => undefined);
  }, [locale]);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = /^(ar|fa|he|ur)(-|$)/i.test(locale) ? "rtl" : "ltr";
  }, [locale]);

  function changeLanguage(nextLocale: string) {
    window.localStorage.setItem(languageStorageKey, nextLocale);
    setLocale(nextLocale);
  }

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
    await submitMessage({ role: "user", text }, true);
  }

  async function submitMessage(message: Message, appendMessage: boolean) {
    const history = appendMessage ? [...messages, message] : messages;
    setDraft(""); setError(null); setLastMessage(message); if (appendMessage) setMessages(history); setLoading(true);
    try {
      const conversation = await fetch("/api/conversation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: history, criteria, locale }) });
      const turn = await conversation.json() as { reply?: string; criteria?: Criteria; ui?: Partial<UiCopy>; error?: string };
      if (!conversation.ok || !turn.reply) throw new Error();
      if (turn.ui) setUi((current) => ({ ...current, ...turn.ui }));
      const nextCriteria = mergeCriteria(criteria, turn.criteria ?? {});
      setCriteria(nextCriteria);
      setMessages((current) => [...current, { role: "assistant", text: turn.reply! }]);
      if (!nextCriteria.location) return;
      await searchProperties(nextCriteria);
    } catch { setError(ui.requestFailed); }
    finally { setLoading(false); }
  }

  async function searchProperties(nextCriteria: Criteria) {
    const response = await fetch("/api/property-search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: nextCriteria.location, mode: nextCriteria.mode ?? "sale", maxPrice: nextCriteria.maxPrice, minBedrooms: nextCriteria.minBedrooms, allowNearby: nextCriteria.allowNearby ?? false, locale }) });
    const body = await response.json() as SearchResponse & { error?: string };
    if (!response.ok) throw new Error();
    setResults(body);
  }

  async function retry() {
    if (loading) return;
    if (messages.at(-1)?.role === "assistant" && criteria.location) {
      setError(null); setLoading(true);
      try { await searchProperties(criteria); } catch { setError(ui.requestFailed); } finally { setLoading(false); }
      return;
    }
    if (lastMessage) await submitMessage(lastMessage, false);
  }

  function reset() { setDraft(""); setCriteria({}); setResults(null); setError(null); setMessages([{ role: "assistant", text: ui.greeting }]); }

  return <main className="chatbot-page"><header><a className="brand" href="/"><span>p</span>propvest.</a><select className="language" value={locale} onChange={(event) => changeLanguage(event.target.value)} aria-label={ui.language}>{languages.map((language) => <option key={language.code} value={language.code}>{language.label}</option>)}</select></header><GlobalPropertyShowcase brief={criteria} copy={ui} />
    <section className="chat-window" id="property-chat"><div className="chat-head"><div><p>{ui.globalPropertyIntelligence}</p><h1>{ui.realEstateExpert}</h1><small>● {ui.hereToHelp}</small></div><button onClick={reset}>{ui.newChat}</button></div>
      <div className="thread" aria-live="polite">{messages.map((message, index) => <div className={`message ${message.role}`} key={`${message.role}-${index}`}><div className="bubble">{message.text}</div></div>)}{loading && <div className="typing"><i/><i/><i/></div>}{error && <div className="search-error" role="alert"><p>{error}</p>{lastMessage && <button type="button" onClick={retry}>{ui.tryAgain}</button>}</div>}{results && <SearchResults results={results} copy={ui} />}</div>
      <div className="chat-suggestions" aria-label={ui.suggestedPrompts}>{ui.suggestions.map((suggestion) => <button key={suggestion} onClick={() => { if (!loading) void submitMessage({ role: "user", text: suggestion }, true); }}>{suggestion}</button>)}</div>
      <form className="chat-composer" onSubmit={send}><label><span>✦</span><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={ui.input} aria-label={ui.propertyRequest} /></label><button className={`dictation ${dictating ? "active" : ""}`} type="button" onClick={toggleDictation} aria-label={dictating ? ui.stopDictation : ui.startDictation}>⌁</button>{draft && <button className="clear-draft" type="button" onClick={() => setDraft("")}>{ui.clear}</button>}<button type="submit" disabled={loading}>{loading ? "…" : ui.send}</button></form><p className="disclaimer">{ui.liveDisclaimer}</p>
    </section>
  </main>;
}

function SearchResults({ results, copy }: { results: SearchResponse; copy: UiCopy }) {
  const hasResults = results.exactMatches.length > 0 || results.nearbyOpportunities.length > 0;
  const time = new Date(results.searchedAt).toLocaleString(copy.locale);
  return <section className="recommendation"><div className="recommendation-intro"><p>{hasResults ? results.illustrative ? copy.propertyDisclaimer : format(copy.verifiedResults, { provider: results.provider, time }) : copy.noResults}</p></div><ListingGroup title={copy.exactMatches} listings={results.exactMatches} copy={copy} /><ListingGroup title={copy.nearbyAlternatives} listings={results.nearbyOpportunities} copy={copy} /></section>;
}
function ListingGroup({ title, listings, copy }: { title: string; listings: Listing[]; copy: UiCopy }) { if (!listings.length) return null; return <section className="listing-group"><h2>{title}</h2><div className="listing-grid">{listings.map((listing) => <article className="listing-card" key={`${listing.source}-${listing.id}`}>{listing.imageUrl && <img src={listing.imageUrl} alt="" />}<p>{listing.location}</p><h3>{listing.title}</h3><strong>{new Intl.NumberFormat(copy.locale, { style: "currency", currency: listing.currency, maximumFractionDigits: 0 }).format(listing.price)}{listing.mode === "rent" ? ` ${copy.rentPerMonth}` : ""}</strong><small>{[listing.bedrooms && `${listing.bedrooms} ${copy.beds}`, listing.bathrooms && `${listing.bathrooms} ${copy.baths}`, listing.areaSqm && `${listing.areaSqm} m²`].filter(Boolean).join(" · ")}</small>{!!listing.features?.length && <p>{listing.features.slice(0, 4).join(" · ")}</p>}<small>{format(copy.retrievedFrom, { source: listing.source, time: new Date(listing.retrievedAt).toLocaleString(copy.locale) })}</small><a href={listing.listingUrl} target="_blank" rel="noreferrer">{copy.verifyListing}</a></article>)}</div></section>; }
function format(template: string, values: Record<string, string>) { return template.replace(/\{(provider|source|time)\}/g, (_, key: string) => values[key] ?? ""); }
function mergeCriteria(current: Criteria, update: Criteria): Criteria { return Object.assign({}, current, ...Object.entries(update).filter(([, value]) => value !== undefined && value !== "").map(([key, value]) => ({ [key]: value }))) as Criteria; }
