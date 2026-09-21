import { describe, it, expect } from 'vitest'
import { decidePopstate, isInAppNavigation } from '../leave-guard'

const here = new URL('https://housepost.co.uk/postcards/design')

describe('isInAppNavigation', () => {
  it('intercepts same-origin path changes', () => {
    expect(isInAppNavigation(new URL('https://housepost.co.uk/dashboard'), here)).toBe(true)
  })
  it('ignores external links, hash links and the same page', () => {
    expect(isInAppNavigation(new URL('https://stannp.com/'), here)).toBe(false)
    expect(isInAppNavigation(new URL('https://housepost.co.uk/postcards/design#top'), here)).toBe(false)
    expect(isInAppNavigation(new URL('https://housepost.co.uk/postcards/design'), here)).toBe(false)
  })
})

describe('decidePopstate', () => {
  it('ignores a Back press when there are no unsaved edits', () => {
    expect(decidePopstate({ dirty: false, dialogOpen: false })).toBe('ignore')
    expect(decidePopstate({ dirty: false, dialogOpen: true })).toBe('ignore')
  })
  it('prompts on a Back press with unsaved edits and no dialog yet', () => {
    expect(decidePopstate({ dirty: true, dialogOpen: false })).toBe('prompt')
  })
  it('re-holds without a second dialog when one is already open', () => {
    expect(decidePopstate({ dirty: true, dialogOpen: true })).toBe('rehold')
  })
})
