/**
 * Address normalisation for the opt-out / suppression list.
 *
 * The problem: an address recorded by HM Land Registry (and stored in
 * `property_transactions.address_line` / `leads.address_line`) and the same
 * address typed by a member of the public into the opt-out form will almost
 * never be byte-for-byte identical. Casing, punctuation, spacing and
 * street-type abbreviations all vary. We need a *stable comparison key* so that
 * "1 TOLPUDDLE ST" and "1 Tolpuddle Street" collapse to the same value and can
 * be matched with a plain string/set lookup — no fuzzy matching, no per-row DB
 * queries.
 *
 * Design principles:
 *  - Deterministic and cheap: pure string work, safe to run over every lead.
 *  - Conservative: we would rather fail to match (and, at worst, post one more
 *    card) than wrongly expand something and either miss a real opt-out or
 *    suppress the wrong property. Every heuristic here errs towards leaving a
 *    token untouched when it is ambiguous.
 *  - The full postcode is the strong discriminator (a UK postcode covers ~15
 *    addresses), so it is always folded into the key.
 *
 * IMPORTANT: this is a heuristic, not a postal-grade address parser. See the
 * "Known limitations / edge cases" note at the foot of this file — the owner
 * should read it before relying on the match rate for compliance.
 */

/**
 * UK street-type abbreviations we expand to their canonical long form.
 * Keys are compared upper-cased with any trailing "." already stripped.
 *
 * Deliberately excluded: standalone "St" — it is handled separately below
 * because it is ambiguous between "Street" and "Saint" (see expandToken).
 */
const STREET_TYPE_ABBREVIATIONS: Record<string, string> = {
  RD: 'ROAD',
  AVE: 'AVENUE',
  AV: 'AVENUE',
  LN: 'LANE',
  CL: 'CLOSE',
  DR: 'DRIVE',
  CT: 'COURT',
  PL: 'PLACE',
  SQ: 'SQUARE',
  CRES: 'CRESCENT',
  GDNS: 'GARDENS',
  GRV: 'GROVE',
  TER: 'TERRACE',
  TERR: 'TERRACE',
  PK: 'PARK',
  HTS: 'HEIGHTS',
  MNR: 'MANOR',
  MT: 'MOUNT',
}

/**
 * Fold a raw postcode into a canonical form: uppercase, internal whitespace
 * removed, then a single space inserted before the final three characters
 * (the inward code), matching Royal Mail formatting — e.g. "sw1a1aa" and
 * "SW1A  1AA" both become "SW1A 1AA".
 *
 * If the input does not look like a normal-length UK postcode we fall back to
 * "uppercase, single-spaced" so the function never throws and always returns a
 * stable string.
 */
export function normalisePostcode(raw: string): string {
  const compact = (raw ?? '').toUpperCase().replace(/\s+/g, '')
  // UK postcodes are 5–7 characters; the inward code is always the last 3.
  if (compact.length >= 5 && compact.length <= 7) {
    return `${compact.slice(0, -3)} ${compact.slice(-3)}`
  }
  return (raw ?? '').toUpperCase().trim().replace(/\s+/g, ' ')
}

/**
 * Expand a single token according to its position within its address segment.
 *
 * @param token          the upper-cased, punctuation-stripped token
 * @param isFirstInSeg   true if this is the first word of its comma segment
 * @param isLastInSeg    true if this is the last word of its comma segment
 *
 * The "St" rule is the subtle one. "St" can mean "Street" (trailing:
 * "Tolpuddle St") or "Saint" (leading: "St Albans"). We only expand it to
 * "STREET" when it is the *last* token of its segment and not also the first —
 * i.e. there is a name in front of it. In every other position we leave it as
 * "ST", which keeps "St Albans", "1 St Marys Close", "St Ives" intact.
 */
function expandToken(token: string, isFirstInSeg: boolean, isLastInSeg: boolean): string {
  if (token === 'ST') {
    // "Saint" unless it is the trailing street-type of a named segment.
    return isLastInSeg && !isFirstInSeg ? 'STREET' : 'ST'
  }
  // A genuine street type never *leads* a segment, so never expand a leading
  // token (guards e.g. a hypothetical "Dr" used as a title/name at the front).
  if (!isFirstInSeg && token in STREET_TYPE_ABBREVIATIONS) {
    return STREET_TYPE_ABBREVIATIONS[token]
  }
  return token
}

/** Strip everything but letters, digits and spaces from an already-upper token group. */
function stripPunctuation(value: string): string {
  // Replace punctuation with spaces (so "1,TOLPUDDLE" -> "1 TOLPUDDLE"), then
  // collapse. Ampersands, apostrophes, hyphens etc. are all dropped.
  return value.replace(/[^A-Z0-9\s]/g, ' ')
}

/**
 * Normalise one comma segment (e.g. "TOLPUDDLE STREET") into its expanded,
 * space-joined token list. Returns an array of tokens (may be empty).
 */
function normaliseSegment(segment: string): string[] {
  const cleaned = stripPunctuation(segment.toUpperCase())
  const tokens = cleaned.split(/\s+/).filter(Boolean)
  return tokens.map((tok, i) =>
    expandToken(tok, i === 0, i === tokens.length - 1)
  )
}

/**
 * Produce a stable comparison key for an address.
 *
 * @param addressLines  the address as one string, or as separate lines/fields.
 *                      Each entry is further split on commas, so a pre-built
 *                      "1, Tolpuddle Street, Islington" line works as well as
 *                      discrete form fields.
 * @param postcode      the postcode (any casing/spacing).
 * @returns a key of the form "<expanded address tokens>|<POSTCODE>", e.g.
 *          "1 TOLPUDDLE STREET ISLINGTON|N1 1AB". Two addresses that a human
 *          would consider the same should produce the same key.
 *
 * The key is intentionally opaque — only ever compare keys produced by this
 * same function; never parse it back apart.
 *
 * @example
 *   addressKey('1 Tolpuddle St', 'N1 1AB')       // "1 TOLPUDDLE STREET|N1 1AB"
 *   addressKey('1, TOLPUDDLE STREET', 'n1  1ab')  // "1 TOLPUDDLE STREET|N1 1AB"
 *   addressKey('St Albans Road', 'AL1 1AA')       // "ST ALBANS ROAD|AL1 1AA"
 */
export function addressKey(
  addressLines: string | Array<string | null | undefined>,
  postcode: string
): string {
  const rawLines = Array.isArray(addressLines) ? addressLines : [addressLines]

  const tokens: string[] = []
  for (const line of rawLines) {
    if (!line) continue
    // Split each supplied line on commas so comma-joined display addresses and
    // multi-field form input are treated identically.
    for (const segment of line.split(',')) {
      tokens.push(...normaliseSegment(segment))
    }
  }

  const addressPart = tokens.join(' ').trim()
  return `${addressPart}|${normalisePostcode(postcode)}`
}

/**
 * A coarser "premises" key for do-not-contact matching.
 *
 * HM Land Registry lines always end in ", Locality, Town" but a member of the
 * public filling in the opt-out form very often leaves the town (or locality)
 * out, so the full addressKey() under-matches. Within a single full postcode
 * (~15 addresses) the building identifiers plus the street are enough to pin
 * the property down, so this key keeps only the segments that identify the
 * premises and folds in the postcode:
 *
 *   • every comma segment containing a digit ("FLAT 2", "10 HIGH STREET", "5");
 *   • when such a segment is a bare number ("5", "10A", "FLAT 2") the segment
 *     that follows it (the street or building name), because the Land Registry
 *     puts the number and the street in separate segments while a person
 *     usually types "5 Grasslands" in one;
 *   • for a named house with no numbers at all, just the first segment.
 *
 *   premisesKey('5, GRASSLANDS, AYLESBURY', 'HP20 1XE')
 *     === premisesKey('5 Grasslands', 'hp201xe')
 *     === '5 GRASSLANDS|HP20 1XE'
 *
 * Screening code checks BOTH keys (see lib/leads/suppression.ts), so a match on
 * either the exact address or the premises suppresses the property.
 */
export function premisesKey(
  addressLines: string | Array<string | null | undefined>,
  postcode: string
): string {
  const rawLines = Array.isArray(addressLines) ? addressLines : [addressLines]
  const segments: string[][] = []
  for (const line of rawLines) {
    if (!line) continue
    for (const segment of line.split(',')) {
      const tokens = normaliseSegment(segment)
      if (tokens.length > 0) segments.push(tokens)
    }
  }

  const hasDigit = (tok: string) => /\d/.test(tok)
  const include = new Set<number>()
  segments.forEach((seg, i) => {
    if (!seg.some(hasDigit)) return
    include.add(i)
    // "5" / "10A" / "FLAT 2": nothing alphabetic after the last number, so the
    // street or building name must be in the next segment.
    const lastDigitIdx = seg.map(hasDigit).lastIndexOf(true)
    const alphaAfterNumber = seg.slice(lastDigitIdx + 1).length > 0
    const next = segments[i + 1]
    if (!alphaAfterNumber && next && !next.some(hasDigit)) include.add(i + 1)
  })
  if (include.size === 0 && segments.length > 0) include.add(0)

  const addressPart = [...include]
    .sort((a, b) => a - b)
    .map((i) => segments[i].join(' '))
    .join(' ')
    .trim()
  return `${addressPart}|${normalisePostcode(postcode)}`
}

/*
 * ── Known limitations / edge cases (owner should review before go-live) ──
 *
 * 1. "St" heuristic. We treat a trailing "St" as "Street" and a leading/mid
 *    "St" as "Saint". This is correct for the overwhelming majority of UK
 *    addresses but will misfire on rarities such as a road whose *name* ends in
 *    "Saint", or unusual constructions like "St Johns St" (handled correctly:
 *    leading ST kept, trailing ST expanded — but exotic cases exist).
 *
 * 2. Locality / town noise. HM Land Registry `address_line` is built as
 *    "SAON, PAON, Street, Locality, Town". If a member of the public omits the
 *    town (or spells the locality differently) their key will NOT match the
 *    stored one, so the property would not be suppressed. Under-matching is the
 *    safe-ish failure mode for the person opting out (they'd get one more card)
 *    but it IS a compliance gap. Mitigations to consider: (a) ask the opt-out
 *    form to reproduce the address exactly as printed on the postcard, and/or
 *    (b) additionally screen on a postcode-only or building+postcode key. This
 *    trade-off is a policy decision for the owner/solicitor.
 *
 * 3. SAON/PAON ordering. Flats etc. ("Flat 2, 1 High Street") depend on the
 *    submitter ordering sub-building and building the same way the Land
 *    Registry does. Token order is preserved, so a different order won't match.
 *
 * 4. Abbreviation coverage. The table above is not exhaustive; unusual street
 *    types not listed are left as-is (conservative — they still match if typed
 *    the same way on both sides).
 */
