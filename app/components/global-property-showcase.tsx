type DemoProperty = {
  title: string;
  location: string;
  type: string;
  price: string;
  facts: string;
  image: string;
};

const properties: DemoProperty[] = [
  { title: "Harbour studio", location: "Valparaíso, Chile", type: "Entry-level apartment", price: "$118k", facts: "1 bed · 1 bath · 42 m²", image: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=640&q=80" },
  { title: "Garden courtyard home", location: "Ubud, Indonesia", type: "Tropical villa", price: "$345k", facts: "2 beds · pool · 160 m²", image: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=640&q=80" },
  { title: "Old town residence", location: "Kotor, Montenegro", type: "Renovation opportunity", price: "€210k", facts: "3 beds · sea view · 118 m²", image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=640&q=80" },
  { title: "Alpine cabin", location: "Åre, Sweden", type: "Mountain home", price: "SEK 4.8m", facts: "3 beds · sauna · 126 m²", image: "https://images.unsplash.com/photo-1510798831971-661eb04b3739?auto=format&fit=crop&w=640&q=80" },
  { title: "Canal-side loft", location: "Ghent, Belgium", type: "City apartment", price: "€475k", facts: "2 beds · terrace · 98 m²", image: "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=640&q=80" },
  { title: "Coastal family house", location: "Wellington, New Zealand", type: "Detached house", price: "NZ$1.25m", facts: "4 beds · garden · 205 m²", image: "https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=640&q=80" },
  { title: "Medina riad", location: "Essaouira, Morocco", type: "Holiday property", price: "MAD 2.9m", facts: "4 beds · roof terrace · 190 m²", image: "https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=640&q=80" },
  { title: "Skyline penthouse", location: "Kuala Lumpur, Malaysia", type: "Luxury residence", price: "RM 5.6m", facts: "4 beds · pool · 310 m²", image: "https://images.unsplash.com/photo-1600607688969-a5bfcd646154?auto=format&fit=crop&w=640&q=80" },
  { title: "Vineyard cottage", location: "Mendoza, Argentina", type: "Country house", price: "$265k", facts: "3 beds · land · 175 m²", image: "https://images.unsplash.com/photo-1500076656116-558758c991c1?auto=format&fit=crop&w=640&q=80" },
  { title: "Island retreat", location: "Naxos, Greece", type: "Beach home", price: "€890k", facts: "3 beds · sea view · 152 m²", image: "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=640&q=80" },
  { title: "Warehouse conversion", location: "Osaka, Japan", type: "Investment property", price: "¥42m", facts: "2 units · 140 m²", image: "https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=640&q=80" },
  { title: "Savannah lodge", location: "Nanyuki, Kenya", type: "Rural estate", price: "$720k", facts: "5 beds · 2.4 ha", image: "https://images.unsplash.com/photo-1510798831971-661eb04b3739?auto=format&fit=crop&w=640&q=80" },
  { title: "Desert-view estate", location: "Scottsdale, USA", type: "Ultra-luxury residence", price: "$12.5m", facts: "6 beds · pool · 780 m²", image: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=640&q=80" },
];

export function GlobalPropertyShowcase() {
  return <aside className="global-showcase" aria-label="Illustrative global property showcase">
    <div className="global-showcase-head"><div><p>Worldwide property universe</p><h2>Explore every way of living</h2></div><span>Illustrative demo</span></div>
    <p className="global-showcase-copy">A visual sampling of locations, property types, and budgets. These cards are synthetic demo content, not live listings.</p>
    <div className="global-property-rail">{properties.map((property) => <article className="global-property-card" key={`${property.title}-${property.location}`}>
      <img src={property.image} alt="" />
      <div><p>{property.location}</p><h3>{property.title}</h3><strong>{property.price}</strong><small>{property.type} · {property.facts}</small></div>
    </article>)}</div>
    <div className="global-coverage"><span>6 continents</span><span>Coastal to rural</span><span>Entry to ultra-luxury</span><span>Homes, land & commercial</span></div>
  </aside>;
}
