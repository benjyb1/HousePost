import { describe, it, expect } from 'vitest'
import {
  SIDECAR_VERSION,
  buildSidecar,
  serialiseSidecar,
  parseSidecar,
  logoRefFromOverlay,
  overlayFromLogoRef,
  type LogoRef,
  type TemplateSidecar,
} from '../template-sidecar'
import type { LogoOverlay } from '../logo/types'
import type { TemplateValues } from '../svg-templates'

const values: TemplateValues = {
  businessName: 'Harbour & Vale',
  tagline: 'Kitchens & joinery',
  phone: '020 1234 5678',
  website: 'www.harbourvale.co.uk',
  offer: 'Free first consultation',
  areaServed: 'Kingston & Surbiton',
  accent: '#0f1f3d',
  backHeadline: 'Just moved in?',
  backMessage: 'A friendly line or two about what we do and why to call.',
  backCta: 'Book a free consultation',
}

const frontRef: LogoRef = {
  url: 'https://proj.supabase.co/storage/v1/object/public/postcard-designs/u1/design-logos/d1-front.png?v=1',
  naturalW: 400,
  naturalH: 200,
  x: 120,
  y: 90,
  w: 360,
}

describe('sidecar serialise/deserialise round-trip', () => {
  it('round-trips values and logo refs through JSON', () => {
    const sidecar: TemplateSidecar = buildSidecar({
      templateId: 'bold',
      values,
      logos: { front: frontRef, back: null },
    })
    const parsed = parseSidecar(serialiseSidecar(sidecar))
    expect(parsed).toEqual(sidecar)
    expect(parsed?.version).toBe(SIDECAR_VERSION)
    expect(parsed?.templateId).toBe('bold')
    expect(parsed?.values).toEqual(values)
    expect(parsed?.logos.front).toEqual(frontRef)
    expect(parsed?.logos.back).toBeNull()
  })

  it('parses an already-parsed object, not only a JSON string', () => {
    const sidecar = buildSidecar({ templateId: 'bold', values, logos: { front: null, back: frontRef } })
    const viaObject = parseSidecar(JSON.parse(serialiseSidecar(sidecar)))
    expect(viaObject).toEqual(sidecar)
  })

  it('preserves fractional logo geometry exactly (no rounding on the way through)', () => {
    const ref: LogoRef = { url: 'u', naturalW: 400.5, naturalH: 200.25, x: 120.75, y: 90.1, w: 360.9 }
    const sidecar = buildSidecar({ templateId: 't', values, logos: { front: ref, back: null } })
    const parsed = parseSidecar(serialiseSidecar(sidecar))
    expect(parsed?.logos.front).toEqual(ref)
  })
})

describe('logo overlay ↔ ref conversion', () => {
  it('overlay → ref drops side + src, keeps geometry and adds the url', () => {
    const overlay: LogoOverlay = {
      side: 'front',
      src: 'data:image/png;base64,AAAA',
      naturalW: 400,
      naturalH: 200,
      x: 120,
      y: 90,
      w: 360,
    }
    const url = 'https://cdn/u1/design-logos/d1-front.png'
    expect(logoRefFromOverlay(overlay, url)).toEqual({
      url,
      naturalW: 400,
      naturalH: 200,
      x: 120,
      y: 90,
      w: 360,
    })
  })

  it('ref → overlay re-attaches side + src and preserves in-bounds geometry', () => {
    const overlay = overlayFromLogoRef(frontRef, 'front', 'data:image/png;base64,BBBB')
    expect(overlay).toEqual({
      side: 'front',
      src: 'data:image/png;base64,BBBB',
      naturalW: 400,
      naturalH: 200,
      x: 120,
      y: 90,
      w: 360,
    })
  })

  it('clamps a resumed BACK logo into the left-half safe area', () => {
    const ref: LogoRef = { url: 'u', naturalW: 400, naturalH: 200, x: 700, y: 90, w: 400 }
    const overlay = overlayFromLogoRef(ref, 'back', 'data:image/png;base64,AAAA')
    expect(overlay.side).toBe('back')
    // BACK_SAFE_RIGHT = 840: the box must stay left of the address fold.
    expect(overlay.x + overlay.w).toBeLessThanOrEqual(840)
  })
})

describe('parseSidecar guards', () => {
  it('returns null for anything that is not a v1 sidecar', () => {
    expect(parseSidecar(null)).toBeNull()
    expect(parseSidecar('not json')).toBeNull()
    expect(parseSidecar(JSON.stringify({ version: 2, templateId: 'x', values }))).toBeNull()
    expect(parseSidecar(JSON.stringify({ version: 1, values }))).toBeNull() // no templateId
    expect(parseSidecar(JSON.stringify({ version: 1, templateId: 'x' }))).toBeNull() // no values
  })

  it('defaults missing logos to null but keeps a valid sidecar', () => {
    const parsed = parseSidecar(JSON.stringify({ version: 1, templateId: 'bold', values }))
    expect(parsed).not.toBeNull()
    expect(parsed?.logos).toEqual({ front: null, back: null })
  })

  it('drops a malformed logo ref to null without discarding the whole sidecar', () => {
    const parsed = parseSidecar(
      JSON.stringify({
        version: 1,
        templateId: 'bold',
        values,
        logos: {
          front: { url: 'u', naturalW: 'nope', naturalH: 1, x: 1, y: 1, w: 1 },
          back: frontRef,
        },
      })
    )
    expect(parsed).not.toBeNull()
    expect(parsed?.logos.front).toBeNull()
    expect(parsed?.logos.back).toEqual(frontRef)
  })
})
