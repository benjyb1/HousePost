'use client'

import { useState } from 'react'
import styles from '../portal.module.css'

/*
  Your saved preferences, shown as chips with an Edit button that opens the
  editor right here (no trip to Settings). Saving uses the same settings API
  as the Settings page. Prices are stored in pence. New preferences shape the
  next monthly homes; this month's list stays as it is.
*/

export type Prefs = {
  radius: number
  minPrice: number | null // pence
  maxPrice: number | null // pence
  types: string[]
}

const RADII = [1, 2, 3, 5, 10, 15, 20]
const PRICES = [150_000, 200_000, 300_000, 400_000, 500_000, 750_000, 1_000_000, 1_500_000, 2_000_000, 3_000_000, 5_000_000].map((p) => p * 100)
const TYPES: { code: string; label: string; chip: string }[] = [
  { code: 'D', label: 'Detached', chip: 'Detached' },
  { code: 'S', label: 'Semi-detached', chip: 'Semi-detached' },
  { code: 'T', label: 'Terraced', chip: 'Terraced' },
  { code: 'F', label: 'Flats', chip: 'Flats' },
]

function money(pence: number) {
  const pounds = pence / 100
  if (pounds >= 1_000_000) return `£${(pounds / 1_000_000).toFixed(1).replace(/\.0$/, '')}m`
  return `£${Math.round(pounds / 1000)}k`
}

function priceChip(min: number | null, max: number | null) {
  if (min && max) return `${money(min)} to ${money(max)}`
  if (min) return `${money(min)} and up`
  if (max) return `Up to ${money(max)}`
  return 'Any price'
}

function typesChip(types: string[]) {
  const chosen = TYPES.filter((t) => types.includes(t.code))
  if (chosen.length === 0 || chosen.length === TYPES.length) return 'All home types'
  return chosen.map((t) => t.chip).join(', ')
}

export function PreferencesPanel({ initial }: { initial: Prefs }) {
  const [saved, setSaved] = useState<Prefs>(initial)
  const [draft, setDraft] = useState<Prefs>(initial)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [justSaved, setJustSaved] = useState(false)

  const radii = RADII.includes(draft.radius) ? RADII : [...RADII, draft.radius].sort((a, b) => a - b)

  async function save() {
    if (draft.minPrice && draft.maxPrice && draft.minPrice > draft.maxPrice) {
      setError('The lowest price is above the highest. Swap them round and try again.')
      return
    }
    if (draft.types.length === 0) {
      setError('Pick at least one type of home.')
      return
    }
    setSaving(true)
    setError(null)
    // No saved types means "every type". Ticking all four in the editor keeps
    // it that way rather than quietly narrowing it.
    const types = saved.types.length === 0 && draft.types.length === TYPES.length ? [] : draft.types
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          search_radius_miles: draft.radius,
          min_price: draft.minPrice,
          max_price: draft.maxPrice,
          property_types: types,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Your preferences were not saved. Please try again.')
        return
      }
      setSaved({ ...draft, types })
      setEditing(false)
      setJustSaved(true)
    } catch {
      setError('Your preferences were not saved. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.prefs}>
      <div className={styles.prefsTop}>
        <span className={styles.prefsLabel}>Your preferences</span>
        <ul className={styles.chips}>
          <li className={styles.chip}>
            Within {saved.radius} mile{saved.radius === 1 ? '' : 's'}
          </li>
          <li className={styles.chip}>{priceChip(saved.minPrice, saved.maxPrice)}</li>
          <li className={styles.chip}>{typesChip(saved.types)}</li>
        </ul>
        {!editing && (
          <button
            type="button"
            className={styles.btnGhost}
            onClick={() => {
              setDraft({ ...saved, types: saved.types.length ? saved.types : TYPES.map((t) => t.code) })
              setEditing(true)
              setJustSaved(false)
            }}
          >
            Edit
          </button>
        )}
      </div>

      {justSaved && !editing && <p className={styles.saved}>Saved. Your next monthly homes will use these.</p>}

      {editing && (
        <div className={styles.edit}>
          <fieldset>
            <legend>How far from your office</legend>
            <div className={styles.seg} role="group" aria-label="Distance in miles">
              {radii.map((r) => (
                <button key={r} type="button" aria-pressed={draft.radius === r} onClick={() => setDraft({ ...draft, radius: r })}>
                  {r} mi
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Sale price</legend>
            <div className={styles.pricePair}>
              <label className="sr-only" htmlFor="pref-min">
                Lowest price
              </label>
              <select
                id="pref-min"
                className={styles.select}
                value={draft.minPrice ?? ''}
                onChange={(e) => setDraft({ ...draft, minPrice: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">No minimum</option>
                {PRICES.map((p) => (
                  <option key={p} value={p}>
                    {money(p)}
                  </option>
                ))}
              </select>
              <span>to</span>
              <label className="sr-only" htmlFor="pref-max">
                Highest price
              </label>
              <select
                id="pref-max"
                className={styles.select}
                value={draft.maxPrice ?? ''}
                onChange={(e) => setDraft({ ...draft, maxPrice: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">No maximum</option>
                {PRICES.map((p) => (
                  <option key={p} value={p}>
                    {money(p)}
                  </option>
                ))}
              </select>
            </div>
          </fieldset>
          <fieldset className={styles.editWide}>
            <legend>Types of home</legend>
            <div className={styles.types}>
              {TYPES.map((t) => (
                <label key={t.code} className={styles.tog}>
                  <input
                    type="checkbox"
                    checked={draft.types.includes(t.code)}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        types: e.target.checked ? [...draft.types, t.code] : draft.types.filter((c) => c !== t.code),
                      })
                    }
                  />
                  <span>{t.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className={styles.editActions}>
            <button type="button" className={styles.btn} onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save preferences'}
            </button>
            <button
              type="button"
              className={styles.textBtn}
              onClick={() => {
                setEditing(false)
                setError(null)
              }}
            >
              Cancel
            </button>
            {error && (
              <p className={styles.err} role="alert">
                {error}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
