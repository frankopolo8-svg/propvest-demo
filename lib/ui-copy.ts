export const uiStringKeys = [
  "newChat", "input", "clear", "send", "liveDisclaimer", "greeting", "propertySupport", "propertyIdeas",
  "demoConcepts", "propertyDisclaimer", "photos", "openGallery", "closeGallery", "previousPhoto", "nextPhoto",
  "illustrativeDemo", "syntheticNotice", "suggestedPrompts", "propertyRequest", "globalPropertyIntelligence",
  "realEstateExpert", "hereToHelp", "exactMatches", "nearbyAlternatives", "verifiedResults", "noResults",
  "rentPerMonth", "beds", "baths", "retrievedFrom", "verifyListing", "requestFailed",
] as const;

export type UiStringKey = (typeof uiStringKeys)[number];
export type UiCopy = Record<UiStringKey, string> & { suggestions: string[]; locale?: string };

export const defaultUi: UiCopy = {
  newChat: "New chat", input: "Tell me what you’re looking for…", clear: "Clear", send: "Send",
  liveDisclaimer: "Live results are retrieved from the configured provider. The surrounding gallery is illustrative demo material only.",
  greeting: "Hello, I’m your real estate assistant. Tell me where and how you’d like to live, in your own words.",
  propertySupport: "Property support", propertyIdeas: "Explore every way of living", demoConcepts: "Demo concepts",
  propertyDisclaimer: "These are responsive, synthetic concepts for the conversation—not live listings.", photos: "photos",
  openGallery: "Open illustrative gallery", closeGallery: "Close gallery", previousPhoto: "Previous photo", nextPhoto: "Next photo",
  illustrativeDemo: "Illustrative demo", syntheticNotice: "Synthetic concept only—not a verified property, price, or availability record.",
  suggestedPrompts: "Suggested prompts", propertyRequest: "Property request", globalPropertyIntelligence: "Global property intelligence",
  realEstateExpert: "Real Estate Expert", hereToHelp: "Here to help", exactMatches: "Exact matches", nearbyAlternatives: "Nearby alternatives",
  verifiedResults: "Verified results from {provider}, retrieved {time}.", noResults: "No verified listing met the current brief.",
  rentPerMonth: "/ month", beds: "beds", baths: "baths", retrievedFrom: "Retrieved from {source} · {time}",
  verifyListing: "Verify listing and availability", requestFailed: "We couldn’t complete that request. Please try again.",
  suggestions: ["Apartments in Barcelona under €350,000", "Luxury villas in Mykonos", "Affordable village homes in Italy", "Family homes near the beach", "Investment properties worldwide"],
};
