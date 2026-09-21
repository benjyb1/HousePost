import { useCallback, useReducer } from 'react'

/** Undo/redo history for a single value. Pure reducer so it can be unit-tested. */
export interface History<T> {
  past: T[]
  present: T
  future: T[]
  /** Which field the last `set` came from and when — used to merge keystrokes into one step. */
  lastKey: string | null
  lastAt: number
}

export type HistoryAction<T> =
  | { type: 'set'; value: T; key?: string; at: number }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'reset'; value: T }
  /** End a coalesced run (e.g. pointer-up after a drag) so the next edit is a new undo step. */
  | { type: 'seal' }

const MAX_PAST = 100
const COALESCE_MS = 800

export function initialHistory<T>(value: T): History<T> {
  return { past: [], present: value, future: [], lastKey: null, lastAt: 0 }
}

export function historyReducer<T>(h: History<T>, action: HistoryAction<T>): History<T> {
  switch (action.type) {
    case 'set': {
      const merge =
        action.key !== undefined && action.key === h.lastKey && action.at - h.lastAt < COALESCE_MS
      const past = merge ? h.past : [...h.past, h.present].slice(-MAX_PAST)
      return { past, present: action.value, future: [], lastKey: action.key ?? null, lastAt: action.at }
    }
    case 'undo': {
      if (h.past.length === 0) return h
      const previous = h.past[h.past.length - 1]
      return {
        past: h.past.slice(0, -1),
        present: previous,
        future: [h.present, ...h.future],
        lastKey: null,
        lastAt: 0,
      }
    }
    case 'redo': {
      if (h.future.length === 0) return h
      const [next, ...rest] = h.future
      return { past: [...h.past, h.present], present: next, future: rest, lastKey: null, lastAt: 0 }
    }
    case 'reset':
      return initialHistory(action.value)
    case 'seal':
      return h.lastKey === null ? h : { ...h, lastKey: null, lastAt: 0 }
  }
}

/**
 * Undo/redo for an editor value. `set(value, key)` — pass the field key so a
 * run of keystrokes in one input collapses into a single undo step.
 */
export function useHistory<T>(initial: T) {
  const reducer = historyReducer as (h: History<T>, a: HistoryAction<T>) => History<T>
  const [h, dispatch] = useReducer(reducer, initial, initialHistory<T>)
  const set = useCallback(
    (value: T, key?: string) => dispatch({ type: 'set', value, key, at: Date.now() }),
    []
  )
  const undo = useCallback(() => dispatch({ type: 'undo' }), [])
  const redo = useCallback(() => dispatch({ type: 'redo' }), [])
  const reset = useCallback((value: T) => dispatch({ type: 'reset', value }), [])
  const seal = useCallback(() => dispatch({ type: 'seal' }), [])
  return {
    value: h.present,
    set,
    undo,
    redo,
    reset,
    seal,
    canUndo: h.past.length > 0,
    canRedo: h.future.length > 0,
  }
}
