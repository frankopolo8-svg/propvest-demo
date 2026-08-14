"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

type DemoProperty = {
  title: string;
  location: string;
  type: string;
  price: string;
  facts: string;
  description: string;
  features: string[];
  images: string[];
};

const image = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=85`;
const properties: DemoProperty[] = [
  { title: "Harbour studio", location: "Valparaíso, Chile", type: "Entry-level apartment", price: "$118k", facts: "1 bed · 1 bath · 42 m²", description: "A compact city base with harbour light and walkable neighbourhood energy.", features: ["Harbour outlook", "Renovated kitchen", "Walkable"], images: [image("photo-1522708323590-d24dbb6b0267"), image("photo-1505693416388-ac5ce068fe85"), image("photo-1484101403633-562f891dc89a")] },
  { title: "Garden courtyard home", location: "Ubud, Indonesia", type: "Tropical villa", price: "$345k", facts: "2 beds · 2 baths · 160 m²", description: "A calm indoor-outdoor retreat designed around a private garden and pool.", features: ["Private pool", "Garden", "Furnished"], images: [image("photo-1600607687939-ce8a6c25118c"), image("photo-1600566753086-00f18fb6b3ea"), image("photo-1600585154340-be6161a56a0c")] },
  { title: "Old town residence", location: "Kotor, Montenegro", type: "Renovation opportunity", price: "€210k", facts: "3 beds · 2 baths · 118 m²", description: "Historic proportions and sea-facing character with scope for a considered restoration.", features: ["Old town", "Sea view", "Terrace"], images: [image("photo-1600585154340-be6161a56a0c"), image("photo-1600607687920-4e2a09cf159d"), image("photo-1600210492486-724fe5c67fb0" )] },
  { title: "Alpine cabin", location: "Åre, Sweden", type: "Mountain home", price: "SEK 4.8m", facts: "3 beds · 2 baths · 126 m²", description: "A warm, all-season cabin pairing mountain access with a quiet private setting.", features: ["Sauna", "Fireplace", "Ski access"], images: [image("photo-1510798831971-661eb04b3739"), image("photo-1512917774080-9991f1c4c750"), image("photo-1511818966892-d7d671e672a2")] },
  { title: "Canal-side loft", location: "Ghent, Belgium", type: "City apartment", price: "€475k", facts: "2 beds · 2 baths · 98 m²", description: "A bright loft-style home with a calm canal setting and contemporary finishes.", features: ["Canal setting", "Lift", "Terrace"], images: [image("photo-1600566753086-00f18fb6b3ea"), image("photo-1600573472550-8090b5e0745e"), image("photo-1497366811353-6870744d04b2")] },
  { title: "Coastal family house", location: "Wellington, New Zealand", type: "Detached house", price: "NZ$1.25m", facts: "4 beds · 3 baths · 205 m²", description: "A relaxed family home with green outlooks, generous living space, and an outdoor flow.", features: ["Garden", "Parking", "Ocean outlook"], images: [image("photo-1600585154526-990dced4db0d"), image("photo-1600607688969-a5bfcd646154"), image("photo-1600607687644-c7171b42498f")] },
  { title: "Medina riad", location: "Essaouira, Morocco", type: "Holiday property", price: "MAD 2.9m", facts: "4 beds · 3 baths · 190 m²", description: "A character-rich stay with a protected courtyard and rooftop entertaining space.", features: ["Roof terrace", "Courtyard", "Guest suite"], images: [image("photo-1548013146-72479768bada"), image("photo-1600607687920-4e2a09cf159d"), image("photo-1600210492486-724fe5c67fb0")] },
  { title: "Skyline penthouse", location: "Kuala Lumpur, Malaysia", type: "Luxury residence", price: "RM 5.6m", facts: "4 beds · 4 baths · 310 m²", description: "An elevated residence with generous entertaining rooms and a full skyline panorama.", features: ["Pool", "Concierge", "Skyline view"], images: [image("photo-1600607688969-a5bfcd646154"), image("photo-1600607687644-c7171b42498f"), image("photo-1600566753190-17f0baa2a6c3")] },
  { title: "Vineyard cottage", location: "Mendoza, Argentina", type: "Country house", price: "$265k", facts: "3 beds · 2 baths · 175 m²", description: "A low-key rural escape with land, long views, and an easy indoor-outdoor rhythm.", features: ["Land", "Vineyard view", "Veranda"], images: [image("photo-1500076656116-558758c991c1"), image("photo-1510798831971-661eb04b3739"), image("photo-1600585154340-be6161a56a0c")] },
  { title: "Island retreat", location: "Naxos, Greece", type: "Beach home", price: "€890k", facts: "3 beds · 3 baths · 152 m²", description: "A breezy island house with terraces designed around sea views and summer living.", features: ["Sea view", "Pool", "Sunset terrace"], images: [image("photo-1600607687920-4e2a09cf159d"), image("photo-1600607688969-a5bfcd646154"), image("photo-1600566753190-17f0baa2a6c3")] },
  { title: "Warehouse conversion", location: "Osaka, Japan", type: "Investment property", price: "¥42m", facts: "2 units · 140 m²", description: "A flexible mixed-use conversion presented as an illustrative investment scenario.", features: ["Two units", "Transit access", "Flexible plan"], images: [image("photo-1497366811353-6870744d04b2"), image("photo-1486406146926-c627a92ad1ab"), image("photo-1497366754035-f200968a6e72")] },
  { title: "Savannah lodge", location: "Nanyuki, Kenya", type: "Rural estate", price: "$720k", facts: "5 beds · 4 baths · 2.4 ha", description: "A generous rural compound that prioritises landscape, privacy, and gathering spaces.", features: ["2.4 ha", "Guest wing", "Landscape views"], images: [image("photo-1510798831971-661eb04b3739"), image("photo-1505693416388-ac5ce068fe85"), image("photo-1600585154526-990dced4db0d")] },
  { title: "Desert-view estate", location: "Scottsdale, USA", type: "Ultra-luxury residence", price: "$12.5m", facts: "6 beds · 7 baths · 780 m²", description: "A dramatic contemporary estate pairing resort-scale amenities with desert views.", features: ["Infinity pool", "Wellness suite", "Desert view"], images: [image("photo-1613490493576-7fde63acd811"), image("photo-1600607687644-c7171b42498f"), image("photo-1600210492486-724fe5c67fb0")] },
];

export function GlobalPropertyShowcase() {
  const [selected, setSelected] = useState<DemoProperty | null>(null);
  const [imageIndex, setImageIndex] = useState(0);
  const open = (property: DemoProperty) => { setSelected(property); setImageIndex(0); };
  const next = (direction: number) => { if (selected) setImageIndex((current) => (current + direction + selected.images.length) % selected.images.length); };

  return <aside className="global-showcase" aria-label="Illustrative global property showcase">
    <div className="global-showcase-head"><div><p>Worldwide property universe</p><h2>Explore every way of living</h2></div><span>Illustrative demo</span></div>
    <p className="global-showcase-copy">Browse synthetic property concepts across locations, lifestyles, and budgets. They are not live listings.</p>
    <div className="global-property-rail">{properties.map((property) => <button className="global-property-card" key={`${property.title}-${property.location}`} onClick={() => open(property)} aria-label={`Open illustrative gallery for ${property.title}`}>
      <div className="global-card-image"><img src={property.images[0]} alt="" /><span>{property.images.length} photos</span></div>
      <div><p>{property.location}</p><h3>{property.title}</h3><strong>{property.price}</strong><small>{property.type} · {property.facts}</small></div>
    </button>)}</div>
    <div className="global-coverage"><span>6 continents</span><span>Coastal to rural</span><span>Entry to ultra-luxury</span><span>Homes, land & commercial</span></div>
    {selected && typeof document !== "undefined" && createPortal(<div className="demo-gallery" role="dialog" aria-modal="true" aria-label={`${selected.title} illustrative gallery`} onMouseDown={() => setSelected(null)}>
      <section onMouseDown={(event) => event.stopPropagation()}><button className="demo-gallery-close" onClick={() => setSelected(null)} aria-label="Close gallery">×</button>
        <div className="demo-gallery-image"><img src={selected.images[imageIndex]} alt="" /><button className="demo-gallery-arrow previous" onClick={() => next(-1)} aria-label="Previous photo">‹</button><button className="demo-gallery-arrow next" onClick={() => next(1)} aria-label="Next photo">›</button><span>{imageIndex + 1} / {selected.images.length} · Illustrative demo</span></div>
        <div className="demo-gallery-copy"><p>{selected.location}</p><h2>{selected.title}</h2><strong>{selected.price}</strong><small>{selected.type} · {selected.facts}</small><p>{selected.description}</p><div>{selected.features.map((feature) => <span key={feature}>{feature}</span>)}</div><em>Synthetic concept only — not a verified property, price, or availability record.</em></div>
      </section>
    </div>, document.body)}
  </aside>;
}
