/**
 * The blank back used when a customer has a front design but no back (for
 * example, a template — templates set the front only). It is a plain white
 * A6+bleed card (1819×1311 @ 300 DPI); the printer adds the recipient address,
 * postage and barcode over its right half, which is exactly what the design
 * page tells the customer will happen. Without this fallback a template-only
 * customer could never send anything.
 *
 * Lives in the public postcard-designs bucket under a fixed key so the printer
 * can fetch it. Upload it with scripts/upload-default-back.mjs.
 */
export const DEFAULT_BACK_PATH = 'defaults/back-blank.png'

export function defaultBackUrl(): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/postcard-designs/${DEFAULT_BACK_PATH}`
}

/** The back artwork to print: the customer's own back, or the blank default. */
export function resolveBackUrl(backUrl: string | null | undefined): string {
  return backUrl && backUrl.trim() ? backUrl : defaultBackUrl()
}
