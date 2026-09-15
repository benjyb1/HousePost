/**
 * Address DISPLAY formatting.
 *
 * HM Land Registry gives us addresses in ALL CAPS ("1, DELL ROAD,
 * NORTHCHURCH"), which reads like a raw database export. This module title-cases
 * an address for display only — it never touches what is stored, and it is
 * deliberately separate from `normalise.ts` (whose job is a stable *comparison*
 * key, not a pretty string).
 *
 * Design principles (mirroring normalise.ts):
 *  - Pure, deterministic, cheap — safe to run over every rendered row.
 *  - Conservative: when a token is ambiguous, prefer a plain Title Case over a
 *    clever guess. The worst case is a slightly odd-looking word, never a
 *    mangled or unrecognisable address.
 *  - Postcodes and unit suffixes ("10A", "221B") are the two things a naive
 *    title-caser gets wrong, so they are handled explicitly.
 */

/**
 * Lower-cased particles that read better in lower case *inside* a name, e.g.
 * "Newcastle upon Tyne", "Stratford-upon-Avon", "Weston-super-Mare", "Isle of
 * Dogs". Never applied to the first word of a comma segment (so "The Limes"
 * keeps its capital "The").
 */
const LOWERCASE_PARTICLES = new Set([
  'of', 'the', 'and', 'on', 'in', 'upon', 'under', 'over', 'by', 'le', 'la',
  'les', 'du', 'de', 'super', 'cum', 'next', 'sur', 'y',
])

// A full UK postcode, e.g. "SW1A 1AA" or "N1 1AB" (with or without the space).
const FULL_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i
// The outward half on its own, e.g. "SW1A", "N1", "EC1A".
const OUTWARD_CODE = /^[A-Z]{1,2}\d[A-Z\d]?$/i
// The inward half on its own, e.g. "1AA".
const INWARD_CODE = /^\d[A-Z]{2}$/i
// A house-number style unit with a trailing letter, e.g. "10A", "221B", "1-3A".
const UNIT_WITH_LETTER = /^\d+[A-Z]$/i

/**
 * Format a postcode for display: upper-cased, with a single space before the
 * three-character inward code (Royal Mail style). Falls back to a trimmed,
 * upper-cased, single-spaced string if the input is not a recognisable length.
 */
export function formatPostcode(raw: string | null | undefined): string {
  const compact = (raw ?? '').toUpperCase().replace(/\s+/g, '')
  if (compact.length >= 5 && compact.length <= 7) {
    return `${compact.slice(0, -3)} ${compact.slice(-3)}`
  }
  return (raw ?? '').toUpperCase().trim().replace(/\s+/g, ' ')
}

/** Title-case a single alphabetic word, respecting apostrophes and hyphens. */
function titleCaseWord(word: string, isFirstInSegment: boolean): string {
  const lower = word.toLowerCase()

  // Keep small particles lower case unless they open the segment.
  if (!isFirstInSegment && LOWERCASE_PARTICLES.has(lower)) {
    return lower
  }

  // Capitalise the first letter, then each part after an apostrophe *only* when
  // that part is long enough to be a name ("O'Brien" -> Brien) rather than a
  // possessive/elision ("Mary's" -> keep the trailing "s" lower).
  return lower.replace(/(^|')([a-z])([a-z]*)/g, (_m, sep: string, first: string, rest: string) => {
    if (sep === "'" && rest.length < 1) return sep + first // e.g. the "s" in "Mary's"
    return sep + first.toUpperCase() + rest
  })
}

/**
 * Format one whitespace-delimited token.
 *  - Postcodes / outward / inward codes -> upper case, spaced if full.
 *  - "10A"/"221B" unit suffixes -> digits kept, trailing letter upper.
 *  - Pure numbers / numeric ranges ("1-3") -> untouched.
 *  - Anything with letters -> title-cased (handling hyphenated compounds).
 */
function formatToken(token: string, isFirstInSegment: boolean): string {
  if (!token) return token

  if (FULL_POSTCODE.test(token)) return formatPostcode(token)
  if (OUTWARD_CODE.test(token) || INWARD_CODE.test(token)) return token.toUpperCase()
  if (UNIT_WITH_LETTER.test(token)) return token.toUpperCase()

  // No letters at all (house numbers, ranges like "1-3") — leave as-is.
  if (!/[a-z]/i.test(token)) return token

  // Hyphenated compounds ("Weston-super-Mare"): format each part, treating only
  // the very first part as segment-initial so interior particles lower-case.
  if (token.includes('-')) {
    return token
      .split('-')
      .map((part, i) => (part ? formatToken(part, isFirstInSegment && i === 0) : part))
      .join('-')
  }

  return titleCaseWord(token, isFirstInSegment)
}

/**
 * Title-case an address line for display. Comma structure is preserved
 * ("1, DELL ROAD, NORTHCHURCH" -> "1, Dell Road, Northchurch"). Storage is never
 * modified — this is a pure display transform.
 */
export function formatAddressLine(raw: string | null | undefined): string {
  if (!raw) return ''
  return raw
    .split(',')
    .map((segment) => {
      const tokens = segment.trim().split(/\s+/).filter(Boolean)
      return tokens.map((tok, i) => formatToken(tok, i === 0)).join(' ')
    })
    .filter(Boolean)
    .join(', ')
}
