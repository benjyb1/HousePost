import { describe, it, expect } from 'vitest'
import {
  decidePopstate,
  isInAppNavigation,
  isSentinelState,
  leaveNavigation,
  LEAVE_GUARD_SENTINEL,
} from '../leave-guard'

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

describe('isSentinelState', () => {
  it('spots our sentinel entry, alongside whatever Next keeps in history state', () => {
    expect(isSentinelState({ __NA: true, [LEAVE_GUARD_SENTINEL]: true })).toBe(true)
  })
  it('is false for ordinary entries and empty state', () => {
    expect(isSentinelState({ __NA: true })).toBe(false)
    expect(isSentinelState(null)).toBe(false)
    expect(isSentinelState(undefined)).toBe(false)
  })
})

describe('leaveNavigation', () => {
  it('replaces the sentinel so one Back press returns to the page that was left', () => {
    expect(leaveNavigation({ __NA: true, [LEAVE_GUARD_SENTINEL]: true })).toBe('replace')
  })
  it('pushes as normal when the sentinel is not on top', () => {
    expect(leaveNavigation({ __NA: true })).toBe('push')
    expect(leaveNavigation(null)).toBe('push')
  })
})
