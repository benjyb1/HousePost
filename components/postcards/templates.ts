// Postcard template gallery config.
//
// Each entry is one ready-made design the customer can open in Canva. Opening a
// Canva *template* link copies that design into the customer's OWN Canva account
// (no shared editing, no login wall on a raw folder), where they edit it and
// export a print-ready PDF to upload under "Upload custom design".
//
// We deliberately drive the gallery from this static array rather than trying to
// share a Canva folder — a folder can't be shared by a single link and a raw
// folder URL hits a login wall.
//
// OWNER TODO: fill in the real Canva template links and preview images. Every
// `canvaUrl` and `previewImage` below is a PLACEHOLDER. Drop the preview PNGs in
// `public/postcard-templates/` and paste each design's "Use as template" /
// "Share > Template link" URL from Canva. The gallery renders a graceful
// placeholder wherever an image is missing, so partial fill-in is fine.

export interface PostcardTemplate {
  /** Stable id (used as a React key and in analytics later). */
  id: string
  /** Human name shown on the card, e.g. the style or the trade it suits. */
  name: string
  /** One-line description of the look / who it suits. */
  description: string
  /**
   * Preview image path under /public. PLACEHOLDER — replace with a real render
   * of the template. Missing images fall back to a neutral placeholder tile.
   */
  previewImage: string
  /**
   * Canva template link. PLACEHOLDER — replace with the real "Use as template"
   * URL. Opening it copies the design into the customer's own Canva account.
   */
  canvaUrl: string
}

/** Set true once a template has a real Canva link so the UI can flag WIP tiles. */
function isPlaceholder(url: string): boolean {
  return url.startsWith('TODO')
}

export const POSTCARD_TEMPLATES: PostcardTemplate[] = [
  {
    id: 'classic-blue',
    name: 'Classic Estate Agent',
    description: 'Clean, trustworthy navy layout with room for your logo and a headline.',
    previewImage: '/postcard-templates/classic-blue.png', // TODO: real preview
    canvaUrl: 'TODO-canva-template-link-classic-blue', // TODO: real Canva template link
  },
  {
    id: 'bold-sold',
    name: 'Just Sold',
    description: 'High-impact "Sold in your street" card to win nearby valuations.',
    previewImage: '/postcard-templates/bold-sold.png', // TODO: real preview
    canvaUrl: 'TODO-canva-template-link-bold-sold', // TODO: real Canva template link
  },
  {
    id: 'minimal-cream',
    name: 'Minimal Cream',
    description: 'Understated, premium feel for higher-value catchments.',
    previewImage: '/postcard-templates/minimal-cream.png', // TODO: real preview
    canvaUrl: 'TODO-canva-template-link-minimal-cream', // TODO: real Canva template link
  },
  {
    id: 'photo-hero',
    name: 'Photo Hero',
    description: 'A full-bleed property photo with a bold call to action.',
    previewImage: '/postcard-templates/photo-hero.png', // TODO: real preview
    canvaUrl: 'TODO-canva-template-link-photo-hero', // TODO: real Canva template link
  },
  {
    id: 'valuation-offer',
    name: 'Free Valuation Offer',
    description: 'Offer-led card built around a free valuation and QR code.',
    previewImage: '/postcard-templates/valuation-offer.png', // TODO: real preview
    canvaUrl: 'TODO-canva-template-link-valuation-offer', // TODO: real Canva template link
  },
  {
    id: 'seasonal',
    name: 'Seasonal Market Update',
    description: 'Warm, newsletter-style card for a local market update drop.',
    previewImage: '/postcard-templates/seasonal.png', // TODO: real preview
    canvaUrl: 'TODO-canva-template-link-seasonal', // TODO: real Canva template link
  },
]

export const templateIsPlaceholder = isPlaceholder
