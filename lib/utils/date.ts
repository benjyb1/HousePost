/** Format pence to a human-readable GBP string, e.g. 25000000 → "£250,000" */
export function formatPricePence(pence: number): string {
  const pounds = pence / 100
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(pounds)
}

// Always UK time. Pages render on the server (UTC on Vercel), so without this a
// card posted at 00:30 BST would show the previous day.
const UK_TIME_ZONE = 'Europe/London'

/** Format an ISO date string as "15 Jan 2025" (UK time) */
export function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: UK_TIME_ZONE,
  })
}

/**
 * Format an ISO timestamp as "28 Sept 2026, 14:03": 24-hour UK time, moving
 * between GMT and BST on its own.
 */
export function formatDateTime(isoDate: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: UK_TIME_ZONE,
  }).format(new Date(isoDate))
}

/** Format YYYY-MM as "January 2025" */
export function formatMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  })
}

/** Current month key YYYY-MM in UTC */
export function currentMonthKey(): string {
  return new Date().toISOString().slice(0, 7)
}
