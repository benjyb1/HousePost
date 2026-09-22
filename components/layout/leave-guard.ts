/**
 * Pure helpers for the portal-wide "unsaved changes" guard. No React or DOM
 * state here so they can be unit-tested on their own (see LeaveGuardProvider
 * for the wiring that uses them).
 */

/** True for a click that would leave this page for another page in the app. */
export function isInAppNavigation(target: URL, current: URL): boolean {
  if (target.origin !== current.origin) return false
  return target.pathname + target.search !== current.pathname + current.search
}

/**
 * Marker stored on the history entry we push purely to intercept the browser
 * Back button. It never changes the URL — it's an extra same-page entry that a
 * Back press lands on so we can ask before actually leaving.
 */
export const LEAVE_GUARD_SENTINEL = '__housepostLeaveGuard'

/**
 * What a `popstate` (a Back/Forward press) should do while the guard is active.
 * - `ignore`   — nothing to protect, let the browser navigate.
 * - `prompt`   — hold the page and open the confirm dialog.
 * - `rehold`   — the dialog is already open; just re-hold so a second Back press
 *                can't slip past while the user is still deciding.
 */
export function decidePopstate(state: { dirty: boolean; dialogOpen: boolean }): 'ignore' | 'prompt' | 'rehold' {
  if (!state.dirty) return 'ignore'
  return state.dialogOpen ? 'rehold' : 'prompt'
}
