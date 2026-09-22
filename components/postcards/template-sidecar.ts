import { clampOverlay, type CardSide, type LogoOverlay } from './logo/types'
import type { TemplateValues } from './svg-templates'

/**
 * Save & resume for a template design.
 *
 * When a template is saved, the finished front/back PNGs go to the usual fixed
 * storage keys and a library row is written — but those are flattened artwork,
 * you can't reopen and edit them. So alongside the library row we persist a
 * "sidecar": the editable state (which template, the text values, and each
 * side's logo geometry) as JSON in Storage, keyed to the library row `id`.
 * Reopening rebuilds the editor from it. No DB migration — it's a Storage file.
 *
 * The functions here are pure (no DOM, no fetch, no Supabase) so they unit-test
 * as a plain state → JSON → state round-trip. The browser-only bits — uploading
 * the logo image and fetching it back as a data URL — live in the editor.
 */

/** Current sidecar schema version. Bump only on an incompatible shape change. */
export const SIDECAR_VERSION = 1 as const

/**
 * A saved logo: where its image bytes live plus its geometry on the card.
 * `url` is the logo's public Storage URL, NOT a data URL — the reopen loader
 * fetches it and converts to a data URL, because `LogoOverlay.src` must be a
 * data URL (a remote src would taint the export canvas — see `logo/types.ts`).
 * The geometry mirrors `LogoOverlay` minus `side` (implied by the map key) and
 * `src` (rehydrated on reopen).
 */
export interface LogoRef {
  url: string
  naturalW: number
  naturalH: number
  x: number
  y: number
  w: number
}

/**
 * The editable state of a saved template, stored at
 * `${userId}/design-editor/${designId}.json`.
 */
export interface TemplateSidecar {
  version: typeof SIDECAR_VERSION
  templateId: string
  values: TemplateValues
  logos: Record<CardSide, LogoRef | null>
}

/** Build a `LogoRef` from a placed overlay + the uploaded logo's public URL. */
export function logoRefFromOverlay(overlay: LogoOverlay, url: string): LogoRef {
  return {
    url,
    naturalW: overlay.naturalW,
    naturalH: overlay.naturalH,
    x: overlay.x,
    y: overlay.y,
    w: overlay.w,
  }
}

/**
 * Rebuild a `LogoOverlay` from a saved ref. `src` is the data URL the loader
 * fetched from `ref.url`. Clamped to the side's safe area so a stale or
 * hand-edited sidecar can never place a logo out of bounds.
 */
export function overlayFromLogoRef(ref: LogoRef, side: CardSide, src: string): LogoOverlay {
  return clampOverlay({
    side,
    src,
    naturalW: ref.naturalW,
    naturalH: ref.naturalH,
    x: ref.x,
    y: ref.y,
    w: ref.w,
  })
}

/** Assemble the sidecar object ready to serialise. */
export function buildSidecar(input: {
  templateId: string
  values: TemplateValues
  logos: Record<CardSide, LogoRef | null>
}): TemplateSidecar {
  return {
    version: SIDECAR_VERSION,
    templateId: input.templateId,
    values: input.values,
    logos: { front: input.logos.front ?? null, back: input.logos.back ?? null },
  }
}

/** The JSON string stored in the bucket. */
export function serialiseSidecar(sidecar: TemplateSidecar): string {
  return JSON.stringify(sidecar)
}

/**
 * Parse + validate a sidecar (a JSON string, or an already-parsed object).
 * Returns `null` for anything that isn't a v1 sidecar we understand, so the
 * caller can fall back to opening the template fresh rather than crash. `values`
 * is passed through as-is; the loader merges it over the template defaults so a
 * missing field can't leave a form input uncontrolled.
 */
export function parseSidecar(raw: unknown): TemplateSidecar | null {
  let obj: unknown = raw
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw)
    } catch {
      return null
    }
  }
  if (!isRecord(obj)) return null
  if (obj.version !== SIDECAR_VERSION) return null
  if (typeof obj.templateId !== 'string' || !obj.templateId) return null
  if (!isRecord(obj.values)) return null
  const logos = isRecord(obj.logos) ? obj.logos : {}
  return {
    version: SIDECAR_VERSION,
    templateId: obj.templateId,
    values: obj.values as unknown as TemplateValues,
    logos: {
      front: parseLogoRef(logos.front),
      back: parseLogoRef(logos.back),
    },
  }
}

function parseLogoRef(raw: unknown): LogoRef | null {
  if (!isRecord(raw)) return null
  const { url, naturalW, naturalH, x, y, w } = raw
  if (typeof url !== 'string' || !url) return null
  const nums = [naturalW, naturalH, x, y, w]
  if (!nums.every((n) => typeof n === 'number' && Number.isFinite(n))) return null
  return {
    url,
    naturalW: naturalW as number,
    naturalH: naturalH as number,
    x: x as number,
    y: y as number,
    w: w as number,
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}
