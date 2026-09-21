// Shared types for the in-browser postcard template editor.

/**
 * The editable content of a template. The FRONT and BACK share the brand and
 * contact (businessName, phone, website, accent); the back also has its own
 * headline, message and call to action so it isn't just an echo of the front.
 */
export interface TemplateValues {
  businessName: string
  tagline: string
  phone: string
  website: string
  /** Short punchy offer / headline line, e.g. "Free first consultation". */
  offer: string
  /** Area the business covers, e.g. "Kingston & Surbiton". */
  areaServed: string
  /** Accent colour as `#rrggbb`. */
  accent: string
  /** Back-of-card headline, e.g. "Just moved in?". */
  backHeadline: string
  /** Back-of-card body message — wraps to a few lines. */
  backMessage: string
  /** Back-of-card call to action, e.g. "Book a free consultation". */
  backCta: string
}

/** One editable field, used to build the form generically. */
export interface TemplateFieldDef {
  key: keyof Omit<TemplateValues, 'accent'>
  label: string
  placeholder: string
  /** Soft character guide shown under the input (text still auto-shrinks). */
  maxHint?: number
  /** Render as a multi-line textarea instead of a single-line input. */
  multiline?: boolean
}

export interface SvgTemplate {
  id: string
  name: string
  /** One-line description of the look / who it suits. */
  description: string
  /** Sensible starting content so a template looks finished on first view. */
  defaults: TemplateValues
  /** Build the FRONT as a complete, self-contained SVG string (1819×1311). */
  render: (values: TemplateValues) => string
  /**
   * Build the BACK as a complete SVG string (1819×1311). The printer prints the
   * address, postage and barcode over the RIGHT half, so the back only decorates
   * the LEFT half; the right half is left white. This matches the full-card the
   * uploader composites for an uploaded back, so the send/proof pipeline treats a
   * template back like any other.
   */
  renderBack: (values: TemplateValues) => string
}

/** The FRONT fields shown in the editor form, in order. */
export const TEMPLATE_FIELDS: TemplateFieldDef[] = [
  { key: 'businessName', label: 'Business name', placeholder: 'Your business name', maxHint: 26 },
  { key: 'tagline', label: 'Tagline / service line', placeholder: 'What you do, in a line', maxHint: 40 },
  { key: 'offer', label: 'Offer / headline', placeholder: 'Free first consultation', maxHint: 30 },
  { key: 'areaServed', label: 'Area served', placeholder: 'Kingston & Surbiton', maxHint: 28 },
  { key: 'phone', label: 'Phone', placeholder: '020 1234 5678', maxHint: 20 },
  { key: 'website', label: 'Website', placeholder: 'www.yourbusiness.co.uk', maxHint: 30 },
]

/**
 * The BACK-specific fields. The back also reuses the business name, phone,
 * website and accent from the front, so those aren't repeated here.
 */
export const TEMPLATE_BACK_FIELDS: TemplateFieldDef[] = [
  { key: 'backHeadline', label: 'Back headline', placeholder: 'Just moved in?', maxHint: 24 },
  {
    key: 'backMessage',
    label: 'Back message',
    placeholder: 'A friendly line or two about what you offer and why to get in touch.',
    maxHint: 150,
    multiline: true,
  },
  { key: 'backCta', label: 'Back call to action', placeholder: 'Book a free consultation', maxHint: 28 },
]
