/** Everything the Account page shows, read on the server (or example data in /dev/account). */
export interface AccountData {
  /** Sign-in email, from Supabase auth. Read-only here. */
  email: string | null
  fullName: string
  companyName: string | null
  officePostcode: string
  emailNotifications: boolean
  subscriptionStatus: string
  subscriptionPeriodEnd: string | null
}

/** Read the JSON body of a failed request without throwing on an empty one. */
export async function readError(res: Response, fallback: string): Promise<string> {
  // The API's own 401 text is a bare "Unauthorized".
  if (res.status === 401) return 'You’ve been signed out. Sign in again, then try once more.'
  try {
    const data = (await res.json()) as { error?: unknown }
    return typeof data.error === 'string' && data.error ? data.error : fallback
  } catch {
    return fallback
  }
}
