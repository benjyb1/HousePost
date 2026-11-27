import { describe, expect, it } from 'vitest'
import { isOwnDesignUrl, parseSettingsPatch } from '../settings'

const supabaseUrl = 'https://proj.supabase.co'
const uid = '11111111-2222-3333-4444-555555555555'
const own = `${supabaseUrl}/storage/v1/object/public/postcard-designs/${uid}/designs/front-1.png`
const ctx = { userId: uid, supabaseUrl }

describe('isOwnDesignUrl', () => {
  it('accepts files in the user’s own folder, with or without a cache-buster', () => {
    expect(isOwnDesignUrl(own, uid, supabaseUrl)).toBe(true)
    expect(isOwnDesignUrl(`${own}?v=123`, uid, supabaseUrl)).toBe(true)
  })
  it.each([
    `${supabaseUrl}/storage/v1/object/public/postcard-designs/99999999-2222-3333-4444-555555555555/designs/x.png`,
    `${supabaseUrl}/storage/v1/object/public/postcard-designs/defaults/back-blank.png`,
    `${supabaseUrl}/storage/v1/object/public/postcard-designs/${uid}/../other/x.png`,
    `${supabaseUrl}/storage/v1/object/public/postcard-designs/${uid}/%2e%2e/other/x.png`,
    `https://evil.example/storage/v1/object/public/postcard-designs/${uid}/x.png`,
    `${supabaseUrl}.evil.example/storage/v1/object/public/postcard-designs/${uid}/x.png`,
    'javascript:alert(1)',
  ])('refuses %s', (url) => {
    expect(isOwnDesignUrl(url, uid, supabaseUrl)).toBe(false)
  })
})

describe('parseSettingsPatch', () => {
  const parse = (body: unknown, c = ctx) => parseSettingsPatch(body, c)

  it('passes a normal Home filter save through', () => {
    const r = parse({ search_radius_miles: 5, min_price: 20000000, max_price: 45000000, property_types: ['T', 'S'] })
    expect(r).toEqual({ ok: true, value: { search_radius_miles: 5, min_price: 20000000, max_price: 45000000, property_types: ['S', 'T'] } })
  })

  it('treats 0 and null prices as no limit', () => {
    expect(parse({ min_price: 0, max_price: null })).toEqual({ ok: true, value: { min_price: null, max_price: null } })
  })

  it.each([
    [{ search_radius_miles: 11 }],
    [{ search_radius_miles: 0 }],
    [{ search_radius_miles: 2.5 }],
    [{ search_radius_miles: true }],
    [{ min_price: -1 }],
    [{ min_price: 1.5 }],
    [{ min_price: '100' }],
    [{ min_price: 50000000, max_price: 40000000 }],
    [{ min_price: 50000000, max_price: 50000000 }],
    [{ property_types: [] }],
    [{ property_types: ['X'] }],
    [{ property_types: 'D' }],
    [{ full_name: 'x'.repeat(121) }],
    [{ full_name: 42 }],
    [{ email_notifications: 'yes' }],
    [{ postcard_design_url: 'https://evil.example/x.png' }],
    [{ office_postcode: '<script>' }],
    [null],
    [[1, 2]],
  ])('refuses %j', (body) => {
    expect(parse(body).ok).toBe(false)
  })

  it('checks one changed price against the saved other one', () => {
    const c = { ...ctx, currentPrices: { min: 30000000, max: null } }
    expect(parse({ max_price: 20000000 }, c).ok).toBe(false)
    expect(parse({ max_price: 40000000 }, c).ok).toBe(true)
  })

  it('lets a design be cleared or set to the user’s own file', () => {
    expect(parse({ postcard_design_back_url: null })).toEqual({ ok: true, value: { postcard_design_back_url: null } })
    expect(parse({ postcard_design_url: own })).toEqual({ ok: true, value: { postcard_design_url: own } })
  })

  it('tidies names and postcodes', () => {
    expect(parse({ full_name: '  Sophie Hart ', company_name: '', office_postcode: ' gu7  1aa ' })).toEqual({
      ok: true,
      value: { full_name: 'Sophie Hart', company_name: null, office_postcode: 'GU7 1AA' },
    })
  })
})
