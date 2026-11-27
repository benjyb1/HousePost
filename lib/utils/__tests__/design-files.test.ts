import { describe, it, expect } from 'vitest'
import { designFile, designGroupKey, isDesignInUse, newDesignPath } from '../design-files'

const base = 'https://proj.supabase.co/storage/v1/object/public/postcard-designs/u1'

describe('designFile', () => {
  it('drops the cache-buster and hash', () => {
    expect(designFile(`${base}/design.png?v=123`)).toBe(`${base}/design.png`)
    expect(designFile(`${base}/design.pdf#toolbar=0`)).toBe(`${base}/design.pdf`)
    expect(designFile(null)).toBe('')
  })
})

describe('designGroupKey', () => {
  it('treats old saves of the same fixed files as one design', () => {
    const a = { front_url: `${base}/design.png?v=1`, back_url: `${base}/design-back.png?v=1` }
    const b = { front_url: `${base}/design.png?v=2`, back_url: `${base}/design-back.png?v=2` }
    expect(designGroupKey(a)).toBe(designGroupKey(b))
  })

  it('keeps a different back apart', () => {
    const png = { front_url: `${base}/design.png?v=1`, back_url: `${base}/design-back.png?v=1` }
    const pdf = { front_url: `${base}/design.png?v=1`, back_url: `${base}/design-back.pdf?v=1` }
    const none = { front_url: `${base}/design.png?v=1`, back_url: null }
    expect(designGroupKey(png)).not.toBe(designGroupKey(pdf))
    expect(designGroupKey(png)).not.toBe(designGroupKey(none))
  })
})

describe('isDesignInUse', () => {
  const front = `${base}/designs/1-front.png`
  const back = `${base}/designs/1-back.png`

  it('matches on files, ignoring the query string', () => {
    expect(
      isDesignInUse({ front_url: `${base}/design.png?v=1`, back_url: `${base}/design-back.png?v=1` }, `${base}/design.png?v=9`, `${base}/design-back.png?v=9`)
    ).toBe(true)
  })

  it('needs the back to match when the design has one', () => {
    expect(isDesignInUse({ front_url: front, back_url: back }, front, back)).toBe(true)
    expect(isDesignInUse({ front_url: front, back_url: `${base}/designs/0-back.png` }, front, back)).toBe(false)
  })

  it('goes on the front alone for a design without a back', () => {
    expect(isDesignInUse({ front_url: front, back_url: null }, front, back)).toBe(true)
  })

  it('is never in use when nothing is active', () => {
    expect(isDesignInUse({ front_url: front, back_url: null }, null, null)).toBe(false)
  })
})

describe('newDesignPath', () => {
  it('stays inside the user folder and keeps the extension', () => {
    expect(newDesignPath('u1', 'front', 'png', 'abc')).toBe('u1/designs/abc-front.png')
    expect(newDesignPath('u1', 'back', 'pdf', 'abc')).toBe('u1/designs/abc-back.pdf')
  })

  it('gives each call its own path', () => {
    expect(newDesignPath('u1', 'front', 'png')).not.toBe(newDesignPath('u1', 'front', 'png'))
  })
})
