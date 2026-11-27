/**
 * Helpers for the saved-designs library and the files behind it.
 *
 * Until Nov 2026 every save overwrote the same two storage objects
 * (`<userId>/design.png`, `<userId>/design-back.png`) and only the `?v=` query
 * on the saved URL changed. So many library rows point at one file. These
 * helpers compare designs by FILE (the URL without its query string), which is
 * how the library collapses those duplicates and decides which one is in use.
 *
 * New saves get their own files under `<userId>/designs/`, so they never
 * collide with each other or with the old fixed paths.
 */

/** The storage file a design URL points at: the URL with any `?query` or `#hash` removed. */
export function designFile(url: string | null | undefined): string {
  if (!url) return ''
  const trimmed = url.trim()
  const cut = trimmed.search(/[?#]/)
  return cut === -1 ? trimmed : trimmed.slice(0, cut)
}

type DesignUrls = { front_url: string; back_url: string | null }

/** Rows with the same key point at the same front AND back files, so they are one design. */
export function designGroupKey(design: DesignUrls): string {
  return `${designFile(design.front_url)}\n${designFile(design.back_url)}`
}

/**
 * Is this library design the card being sent right now? Its front must be the
 * active front file. If it has a back, that must be the active back file too.
 * A design with no back of its own keeps whatever back is active when it is
 * set, so the front alone decides.
 */
export function isDesignInUse(
  design: DesignUrls,
  activeFrontUrl: string | null | undefined,
  activeBackUrl: string | null | undefined
): boolean {
  const activeFront = designFile(activeFrontUrl)
  if (!activeFront || designFile(design.front_url) !== activeFront) return false
  if (!design.back_url) return true
  return designFile(design.back_url) === designFile(activeBackUrl)
}

/**
 * A fresh storage path for one side of a new save, inside the user's own
 * folder (the bucket's policies key on the first folder being the user id).
 * Pass the same `stamp` for both sides of one save so they sit together.
 */
export function newDesignPath(
  userId: string,
  side: 'front' | 'back',
  ext: 'png' | 'pdf',
  stamp: string = newDesignStamp()
): string {
  return `${userId}/designs/${stamp}-${side}.${ext}`
}

/** Time-ordered and unique enough that two saves never share a file. */
export function newDesignStamp(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
