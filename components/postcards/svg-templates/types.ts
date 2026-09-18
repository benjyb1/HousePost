// Shared types for the in-browser postcard template editor.

/** The editable content of a postcard front, common to every template. */
export interface TemplateValues {
  businessName: string
  tagline: string
  phone: string
  website: string
  /** Short punchy offer / headline line, e.g. "Free valuation this month". */
  offer: string
  /** Area the agent covers, e.g. "Kingston & Surbiton". */
  areaServed: string
  /** Accent colour as `#rrggbb`. */
  accent: string
}

/** One editable field, used to build the form generically. */
export interface TemplateFieldDef {
  key: keyof Omit<TemplateValues, 'accent'>
  label: string
  placeholder: string
  /** Soft character guide shown under the input (text still auto-shrinks). */
  maxHint?: number
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

/** The fields shown in the editor form, in order. */
export const TEMPLATE_FIELDS: TemplateFieldDef[] = [
  { key: 'businessName', label: 'Business name', placeholder: 'Your agency name', maxHint: 26 },
  { key: 'tagline', label: 'Tagline / service line', placeholder: 'Local property experts', maxHint: 40 },
  { key: 'offer', label: 'Offer / headline', placeholder: 'Free valuation this month', maxHint: 30 },
  { key: 'areaServed', label: 'Area served', placeholder: 'Kingston & Surbiton', maxHint: 28 },
  { key: 'phone', label: 'Phone', placeholder: '020 1234 5678', maxHint: 20 },
  { key: 'website', label: 'Website', placeholder: 'www.youragency.co.uk', maxHint: 30 },
]
