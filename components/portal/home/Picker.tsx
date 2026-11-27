'use client'

import { useEffect, useRef, useState } from 'react'
import s from './home.module.css'

export type PickerOption<T> = { value: T; label: string; disabled?: boolean }

type Props<T> = {
  /** Read out with the value, e.g. "Distance". */
  label: string
  /** What the closed button shows. */
  display: string
  value: T
  options: PickerOption<T>[]
  onChange: (value: T) => void
  /** Adds a box above the list for typing a value that isn't in it. */
  custom?: { placeholder: string; parse: (text: string) => T | null; error: string }
  wide?: boolean
  /** The compact size, for the sort control above the list. Its list opens to the left. */
  small?: boolean
}

/**
 * Our own dropdown, used instead of the browser's suggestion list (which looks
 * like Chrome, not Housepost, and let people type 400 miles). It shows a fixed
 * list of choices; `custom` adds a box for typing your own.
 */
export function Picker<T extends string | number>({ label, display, value, options, onChange, custom, wide, small }: Props<T>) {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    if (!open) return
    const outside = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    // start on the current choice
    const list = listRef.current
    const current = list?.querySelector<HTMLButtonElement>('[aria-selected="true"]') ?? list?.querySelector<HTMLButtonElement>('button:not([disabled])')
    current?.scrollIntoView({ block: 'nearest' })
    current?.focus({ preventScroll: true })
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])

  function close(refocus = true) {
    setOpen(false)
    setTyped('')
    setErr(null)
    if (refocus) btnRef.current?.focus()
  }
  function choose(v: T) {
    onChange(v)
    close()
  }
  function submitTyped() {
    if (!custom) return
    const v = custom.parse(typed)
    if (v == null) return setErr(custom.error)
    choose(v)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
      return
    }
    if (e.key === 'Tab') return close(false)
    const list = listRef.current
    if (!list || (e.target as HTMLElement).tagName === 'INPUT') return
    const items = [...list.querySelectorAll<HTMLButtonElement>('button:not([disabled])')]
    const i = items.indexOf(document.activeElement as HTMLButtonElement)
    let next: HTMLButtonElement | undefined
    if (e.key === 'ArrowDown') next = items[Math.min(i + 1, items.length - 1)]
    else if (e.key === 'ArrowUp') next = items[Math.max(i - 1, 0)]
    else if (e.key === 'Home') next = items[0]
    else if (e.key === 'End') next = items[items.length - 1]
    if (next) {
      e.preventDefault()
      next.focus()
    }
  }

  return (
    <div ref={wrapRef} className={`${s.pick} ${wide ? s.pickWide : ''} ${small ? s.pickSmall : ''}`} onKeyDown={open ? onKeyDown : undefined}>
      <button
        ref={btnRef}
        type="button"
        className={s.pickBtn}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${display}`}
        onClick={() => (open ? close() : setOpen(true))}
        onKeyDown={(e) => {
          if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault()
            setOpen(true)
          }
        }}
      >
        <span>{display}</span>
        <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {open && (
        <div className={s.pop}>
          {custom && (
            // a div, not a form: the picker already sits inside the filters form
            <div className={s.popType}>
              <input
                value={typed}
                onChange={(e) => { setTyped(e.target.value); setErr(null) }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    submitTyped()
                  }
                }}
                placeholder={custom.placeholder}
                aria-label={`Type a ${label.toLowerCase()}`}
                // "text", not "decimal": prices are typed as "450k" or "1.2m".
                inputMode="text"
                autoComplete="off"
              />
              <button type="button" disabled={!typed.trim()} onClick={submitTyped}>Use</button>
              {err && <p role="alert">{err}</p>}
            </div>
          )}
          <ul ref={listRef} role="listbox" aria-label={label}>
            {options.map((o) => (
              <li key={String(o.value)}>
                <button
                  type="button"
                  role="option"
                  aria-selected={o.value === value}
                  disabled={o.disabled}
                  onClick={() => choose(o.value)}
                >
                  {o.label}
                  {o.value === value && (
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
