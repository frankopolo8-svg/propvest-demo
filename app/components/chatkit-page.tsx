"use client";

import { FormEvent, useState } from "react";
import { GlobalPropertyShowcase } from "./global-property-showcase";

type Listing = { id: string; title: string; location: string; price: number; currency: string; mode: "sale" | "rent"; bedrooms?: number; bathrooms?: number; areaSqm?: number; features?: string[]; imageUrl?: string; listingUrl: string; source: string; retrievedAt: string };
type SearchResponse = { exactMatches: Listing[]; nearbyOpportunities: Listing[]; provider: string; searchedAt: string };
type Message = { role: "assistant" | "user"; text: string };
type Language = "en" | "el" | "es" | "fr" | "de" | "it";
type SearchCriteria = { location?: string; mode?: "sale" | "rent"; maxPrice?: number; minBedrooms?: number; allowNearby?: boolean; propertyType?: string };

const suggestions = ["Apartments in Barcelona under €350,000", "Luxury villas in Mykonos", "Affordable village homes in Italy", "Family homes near the beach", "Investment properties worldwide"];
const copy: Record<Language, Record<string, string>> = {
  en: { welcome: "Hello, I’m your real estate assistant. Tell me where and how you’d like to live, in your own words.", askLocation: "Which city, town, village, region, or country should I focus on? You can mention your budget, whether you want to buy or rent, and bedrooms whenever you’re ready.", checking: "I’m checking verified inventory in", found: "I found verified options. Exact matches and clearly labeled nearby alternatives appear below to support our conversation.", none: "I didn’t find a verified match for that brief yet. We can keep the location exact, refine the budget or requirements, or consider nearby areas only if you want to.", unavailable: "I couldn’t retrieve live inventory right now. I haven’t replaced it with demo listings; we can refine your brief or try again later.", reset: "New conversation started. Tell me what kind of place you’re looking for and where you’d like to focus.", newChat: "New chat", input: "Tell me what you’re looking for…", clear: "Clear", send: "Send", live: "Live results are retrieved from the configured provider. The surrounding gallery is illustrative demo material only." },
  el: { welcome: "Γεια σας, είμαι ο σύμβουλος ακινήτων σας. Πείτε μου με φυσικό τρόπο πού και πώς θα θέλατε να ζήσετε.", askLocation: "Σε ποια πόλη, χωριό, περιοχή ή χώρα να εστιάσω; Μπορείτε να αναφέρετε budget, αγορά ή ενοικίαση και αριθμό υπνοδωματίων.", checking: "Ελέγχω επαληθευμένες επιλογές στην", found: "Βρήκα επαληθευμένες επιλογές. Οι ακριβείς αντιστοιχίες και οι ξεκάθαρα σημειωμένες κοντινές εναλλακτικές εμφανίζονται παρακάτω.", none: "Δεν βρήκα ακόμη επαληθευμένη αντιστοιχία. Μπορούμε να κρατήσουμε την τοποθεσία ακριβή, να βελτιώσουμε το budget ή τις προϋποθέσεις, ή να δούμε κοντινές περιοχές μόνο αν το θέλετε.", unavailable: "Δεν μπορώ να ανακτήσω ζωντανό απόθεμα αυτή τη στιγμή. Δεν το αντικατέστησα με demo αγγελίες· μπορούμε να βελτιώσουμε το αίτημα ή να προσπαθήσουμε αργότερα.", reset: "Ξεκινήσαμε νέα συνομιλία. Πείτε μου τι είδους ακίνητο αναζητάτε και πού θέλετε να εστιάσουμε.", newChat: "Νέα συνομιλία", input: "Πείτε μου τι αναζητάτε…", clear: "Καθαρισμός", send: "Αποστολή", live: "Τα ζωντανά αποτελέσματα προέρχονται από τον συνδεδεμένο πάροχο. Η περιμετρική γκαλερί είναι μόνο ενδεικτικό demo υλικό." },
  es: { welcome: "Hola, soy tu asistente inmobiliario. Cuéntame con naturalidad dónde y cómo te gustaría vivir.", askLocation: "¿En qué ciudad, pueblo, región o país debo centrarme? Puedes mencionar presupuesto, compra o alquiler y dormitorios.", checking: "Estoy revisando inventario verificado en", found: "Encontré opciones verificadas. Las coincidencias exactas y las alternativas cercanas claramente etiquetadas aparecen abajo.", none: "Aún no encontré una coincidencia verificada. Podemos mantener la ubicación exacta, ajustar el presupuesto o requisitos, o ver zonas cercanas solo si quieres.", unavailable: "No pude recuperar inventario en vivo ahora. No lo sustituí con anuncios demo; podemos afinar tu búsqueda o intentarlo más tarde.", reset: "Nueva conversación. Cuéntame qué tipo de propiedad buscas y dónde quieres centrarte.", newChat: "Nuevo chat", input: "Cuéntame qué buscas…", clear: "Borrar", send: "Enviar", live: "Los resultados en vivo proceden del proveedor configurado. La galería exterior es solo material de demostración." },
  fr: { welcome: "Bonjour, je suis votre assistant immobilier. Dites-moi où et comment vous aimeriez vivre.", askLocation: "Dans quelle ville, village, région ou quel pays dois-je chercher ?", checking: "Je vérifie les annonces dans", found: "J’ai trouvé des options vérifiées. Les correspondances exactes et les alternatives proches sont indiquées ci-dessous.", none: "Je n’ai pas encore trouvé de correspondance vérifiée. Nous pouvons affiner les critères sans modifier la zone demandée.", unavailable: "Je ne peux pas récupérer les annonces en direct pour le moment.", reset: "Nouvelle conversation. Dites-moi ce que vous recherchez.", newChat: "Nouvelle discussion", input: "Dites-moi ce que vous recherchez…", clear: "Effacer", send: "Envoyer", live: "Les résultats sont fournis par le prestataire connecté. La galerie est une démonstration illustrative." },
  de: { welcome: "Hallo, ich bin Ihr Immobilienassistent. Erzählen Sie mir, wo und wie Sie wohnen möchten.", askLocation: "Auf welche Stadt, welches Dorf, welche Region oder welches Land soll ich mich konzentrieren?", checking: "Ich prüfe verifizierte Angebote in", found: "Ich habe verifizierte Optionen gefunden. Exakte Treffer und nahe Alternativen sind unten getrennt dargestellt.", none: "Ich habe noch keinen verifizierten Treffer gefunden. Wir können die Kriterien verfeinern, ohne den Ort zu ändern.", unavailable: "Live-Angebote sind derzeit nicht verfügbar.", reset: "Neue Unterhaltung. Erzählen Sie mir, was Sie suchen.", newChat: "Neue Unterhaltung", input: "Erzählen Sie mir, was Sie suchen…", clear: "Löschen", send: "Senden", live: "Live-Ergebnisse stammen vom verbundenen Anbieter. Die Galerie ist nur illustratives Demo-Material." },
  it: { welcome: "Ciao, sono il tuo assistente immobiliare. Dimmi dove e come vorresti vivere.", askLocation: "Su quale città, paese, regione o nazione devo concentrarmi?", checking: "Sto verificando annunci in", found: "Ho trovato opzioni verificate. Le corrispondenze esatte e le alternative vicine sono separate qui sotto.", none: "Non ho ancora trovato una corrispondenza verificata. Possiamo affinare i criteri mantenendo la posizione esatta.", unavailable: "Non riesco a recuperare annunci dal vivo in questo momento.", reset: "Nuova conversazione. Dimmi cosa stai cercando.", newChat: "Nuova chat", input: "Dimmi cosa stai cercando…", clear: "Cancella", send: "Invia", live: "I risultati dal vivo provengono dal provider collegato. La galleria è solo materiale illustrativo demo." },
};

export function ChatKitPage() {
  const [draft, setDraft] = useState("");
  const [language, setLanguage] = useState<Language>("en");
  const [criteria, setCriteria] = useState<SearchCriteria>({});
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", text: copy.en.welcome }]);
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const t = copy[language];

  async function send(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || loading) return;
    const nextLanguage = detectLanguage(text);
    const local = copy[nextLanguage];
    const nextCriteria = mergeCriteria(criteria, parseRequest(text));
    setDraft(""); setLanguage(nextLanguage); setError(null); setMessages((current) => [...current, { role: "user", text }]);
    setCriteria(nextCriteria);

    if (!nextCriteria.location) { setMessages((current) => [...current, { role: "assistant", text: local.askLocation }]); return; }
    setLoading(true);
    setMessages((current) => [...current, { role: "assistant", text: `${local.checking} ${nextCriteria.location}.` }]);
    try {
      const response = await fetch("/api/property-search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: nextCriteria.location, mode: nextCriteria.mode ?? "sale", maxPrice: nextCriteria.maxPrice, minBedrooms: nextCriteria.minBedrooms, allowNearby: nextCriteria.allowNearby ?? false }) });
      const body = await response.json() as SearchResponse & { error?: string };
      if (!response.ok) throw new Error(body.error || "Property search failed.");
      setResults(body);
      const count = body.exactMatches.length + body.nearbyOpportunities.length;
      setMessages((current) => [...current, { role: "assistant", text: count ? local.found : local.none }]);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Property search failed.");
      setMessages((current) => [...current, { role: "assistant", text: local.unavailable }]);
    } finally { setLoading(false); }
  }

  function reset() { setDraft(""); setCriteria({}); setResults(null); setError(null); setLoading(false); setMessages([{ role: "assistant", text: t.reset }]); }

  return <main className="chatbot-page"><header><a className="brand" href="/"><span>p</span>propvest.</a></header><GlobalPropertyShowcase />
    <section className="chat-window" id="property-chat"><div className="chat-head"><div><p>Global property intelligence</p><h1>Real Estate Expert</h1><small>● Here to help</small></div><button onClick={reset}>{t.newChat}</button></div>
      <div className="thread" aria-live="polite">{messages.map((message, index) => <div className={`message ${message.role}`} key={`${message.role}-${index}`}><div className="bubble">{message.text}</div></div>)}{loading && <div className="typing"><i/><i/><i/></div>}{error && <p className="search-error" role="alert">{error}</p>}{results && <SearchResults results={results} language={language} />}</div>
      <div className="chat-suggestions" aria-label="Suggested prompts">{suggestions.map((suggestion) => <button key={suggestion} onClick={() => setDraft(suggestion)}>{suggestion}</button>)}</div>
      <form className="chat-composer" onSubmit={send}><label><span>✦</span><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={t.input} aria-label="Property request" /></label>{draft && <button className="clear-draft" type="button" onClick={() => setDraft("")}>{t.clear}</button>}<button type="submit" disabled={loading}>{loading ? "…" : t.send}</button></form><p className="disclaimer">{t.live}</p>
    </section>
  </main>;
}

function SearchResults({ results, language }: { results: SearchResponse; language: Language }) {
  const exact = language === "el" ? "Ακριβείς αντιστοιχίες" : language === "es" ? "Coincidencias exactas" : "Exact matches";
  const nearby = language === "el" ? "Κοντινές εναλλακτικές" : language === "es" ? "Alternativas cercanas" : "Nearby alternatives";
  const hasResults = results.exactMatches.length > 0 || results.nearbyOpportunities.length > 0;
  return <section className="recommendation"><div className="recommendation-intro"><p>{hasResults ? `Verified results from ${results.provider}, retrieved ${new Date(results.searchedAt).toLocaleString()}.` : "No verified listing met the current brief."}</p></div><ListingGroup title={exact} listings={results.exactMatches} /><ListingGroup title={nearby} listings={results.nearbyOpportunities} /></section>;
}
function ListingGroup({ title, listings }: { title: string; listings: Listing[] }) { if (!listings.length) return null; return <section className="listing-group"><h2>{title}</h2><div className="listing-grid">{listings.map((listing) => <article className="listing-card" key={`${listing.source}-${listing.id}`}>{listing.imageUrl && <img src={listing.imageUrl} alt="" />}<p>{listing.location}</p><h3>{listing.title}</h3><strong>{new Intl.NumberFormat(undefined, { style: "currency", currency: listing.currency, maximumFractionDigits: 0 }).format(listing.price)}{listing.mode === "rent" ? " / month" : ""}</strong><small>{[listing.bedrooms && `${listing.bedrooms} beds`, listing.bathrooms && `${listing.bathrooms} baths`, listing.areaSqm && `${listing.areaSqm} m²`].filter(Boolean).join(" · ")}</small>{!!listing.features?.length && <p>{listing.features.slice(0, 4).join(" · ")}</p>}<small>Retrieved from {listing.source} · {new Date(listing.retrievedAt).toLocaleString()}</small><a href={listing.listingUrl} target="_blank" rel="noreferrer">Verify listing and availability</a></article>)}</div></section>; }

function mergeCriteria(current: SearchCriteria, update: SearchCriteria): SearchCriteria {
  return Object.assign({}, current, ...Object.entries(update).filter(([, value]) => value !== undefined && value !== "").map(([key, value]) => ({ [key]: value }))) as SearchCriteria;
}
function detectLanguage(text: string): Language { if (/\p{Script=Greek}/u.test(text)) return "el"; if (/\b(?:hola|quiero|casa|piso|alquiler)\b/i.test(text)) return "es"; if (/\b(?:bonjour|maison|appartement)\b/i.test(text)) return "fr"; if (/\b(?:hallo|wohnung|haus)\b/i.test(text)) return "de"; if (/\b(?:ciao|casa|appartamento)\b/i.test(text)) return "it"; return "en"; }
function parseRequest(text: string): SearchCriteria {
  const amount = text.match(/(?:€|\$|£|AED\s?|USD\s?|EUR\s?)([\d,.]+)\s*([km])?/i); const price = amount ? Number(amount[1].replace(/,/g, "")) * (amount[2]?.toLowerCase() === "m" ? 1_000_000 : amount[2]?.toLowerCase() === "k" ? 1_000 : 1) : undefined;
  const beds = text.match(/(\d+)\s*(?:bed(?:room)?s?|br\b|υπνοδωμάτια?)/i);
  return { location: locationFrom(text), mode: /\b(rent|rental|lease|ενοικ|alquiler|louer)\b/i.test(text) ? "rent" : /\b(buy|purchase|αγορ|comprar|acheter)\b/i.test(text) ? "sale" : undefined, maxPrice: price, minBedrooms: beds ? Number(beds[1]) : undefined, allowNearby: /\b(nearby|near|around|surrounding|κοντιν|cerca)\b/i.test(text) || undefined };
}
function locationFrom(text: string) { const match = text.match(/\b(?:in|near|around|at|στην?|στον?|στη|σε|en|near|cerca de)\s+([\p{L}][\p{L}\s'’.-]{1,70}?)(?=\s+(?:under|below|for|with|budget|and|from|μέχρι|με|για|hasta|con)\b|[,.!?]|$)/iu); const location = match?.[1].trim() || ""; return /^(?:the )?(?:beach|sea|city|mountains?|countryside|worldwide)$/i.test(location) ? "" : location; }
