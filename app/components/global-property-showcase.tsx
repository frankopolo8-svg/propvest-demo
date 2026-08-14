"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { UiCopy } from "../../lib/ui-copy";

export type DemoBrief = { location?: string; propertyType?: string; maxPrice?: number; minBedrooms?: number };
type DemoProperty = { title: string; location: string; type: string; price: string; facts: string; description: string; features: string[]; images: string[]; label: string };
const image = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=85`;
const imageSets = [
  [image("photo-1600585154340-be6161a56a0c"), image("photo-1600566753086-00f18fb6b3ea"), image("photo-1600210492486-724fe5c67fb0")],
  [image("photo-1600607687920-4e2a09cf159d"), image("photo-1600607688969-a5bfcd646154"), image("photo-1600607687644-c7171b42498f")],
  [image("photo-1510798831971-661eb04b3739"), image("photo-1505693416388-ac5ce068fe85"), image("photo-1484101403633-562f891dc89a")],
  [image("photo-1497366811353-6870744d04b2"), image("photo-1486406146926-c627a92ad1ab"), image("photo-1497366754035-f200968a6e72")],
  [image("photo-1449158743715-0a90ebb6d2d8"), image("photo-1600585152915-d208bec867a1"), image("photo-1600047509807-ba8f99d2cdde")],
  [image("photo-1564013799919-ab600027ffc6"), image("photo-1600573472550-8090b5e0745e"), image("photo-1600210491892-03d54c0aaf87")],
];

export function GlobalPropertyShowcase({ brief = {}, copy }: { brief?: DemoBrief; copy: UiCopy }) {
  const properties = useMemo(() => createConcepts(brief, copy), [brief.location, brief.propertyType, brief.maxPrice, brief.minBedrooms]);
  const [selected, setSelected] = useState<DemoProperty | null>(null);
  const [imageIndex, setImageIndex] = useState(0);
  const open = (property: DemoProperty) => { setSelected(property); setImageIndex(0); };
  const next = (direction: number) => { if (selected) setImageIndex((current) => (current + direction + selected.images.length) % selected.images.length); };

  return <aside className="global-showcase" aria-label={copy.propertySupport}>
    <div className="global-showcase-head"><div><p>{copy.propertySupport}</p><h2>{brief.location ? `${copy.propertyIdeas}: ${brief.location}` : copy.propertyIdeas}</h2></div><span>{copy.demoConcepts}</span></div>
    <p className="global-showcase-copy">{copy.propertyDisclaimer}</p>
    <div className="global-property-rail">{properties.map((property) => <button className="global-property-card" key={property.label} onClick={() => open(property)} aria-label={`${copy.openGallery}: ${property.title}`}><div className="global-card-image"><img src={property.images[0]} alt="" /><span>{property.images.length} {copy.photos}</span></div><div><p>{property.location}</p><h3>{property.title}</h3><strong>{property.price}</strong><small>{property.type} · {property.facts}</small></div></button>)}</div>
    {selected && typeof document !== "undefined" && createPortal(<div className="demo-gallery" role="dialog" aria-modal="true" aria-label={`${selected.title}: ${copy.openGallery}`} onMouseDown={() => setSelected(null)}><section onMouseDown={(event) => event.stopPropagation()}><button className="demo-gallery-close" onClick={() => setSelected(null)} aria-label={copy.closeGallery}>×</button><div className="demo-gallery-image"><img src={selected.images[imageIndex]} alt="" /><button className="demo-gallery-arrow previous" onClick={() => next(-1)} aria-label={copy.previousPhoto}>‹</button><button className="demo-gallery-arrow next" onClick={() => next(1)} aria-label={copy.nextPhoto}>›</button><span>{imageIndex + 1} / {selected.images.length} · {copy.illustrativeDemo}</span></div><div className="demo-gallery-copy"><p>{selected.location}</p><h2>{selected.title}</h2><strong>{selected.price}</strong><small>{selected.type} · {selected.facts}</small><p>{selected.description}</p><div>{selected.features.map((feature) => <span key={feature}>{feature}</span>)}</div><em>{copy.syntheticNotice}</em></div></section></div>, document.body)}
  </aside>;
}

function createConcepts(brief: DemoBrief, copy: UiCopy): DemoProperty[] {
  const location = brief.location || copy.propertySupport;
  const type = brief.propertyType || copy.propertyIdeas;
  const budget = brief.maxPrice;
  const beds = brief.minBedrooms || 2;
  const price = (ratio: number) => budget ? formatPrice(Math.max(35_000, Math.round(budget * ratio))) : ["€165k", "€320k", "€640k", "€1.25m"][Math.round(ratio * 3)];
  const concepts = [
    [copy.bestMatch, type, 0.92], [copy.bestValue, type, 0.78], [copy.lowerCostOption, type, 0.62],
    [copy.largerOption, type, 0.98], [copy.premiumOption, type, 1.08], [copy.alternativeStyle, type, 0.88],
  ] as const;
  return concepts.map(([label, title, ratio], index) => ({ label, title, location, type, price: price(ratio), facts: `${beds + (index === 2 ? 1 : 0)} ${copy.beds} · ${beds > 2 ? 2 : 1} ${copy.baths} · ${70 + index * 35} m²`, description: copy.propertyDisclaimer, features: [copy.propertySupport, copy.propertyIdeas, copy.demoConcepts], images: imageSets[index] }));
}
function formatPrice(value: number) { return value >= 1_000_000 ? `€${(value / 1_000_000).toFixed(2)}m` : `€${Math.round(value / 1000)}k`; }
