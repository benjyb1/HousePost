/**
 * Returns the actual run date for a given target day of the month.
 * If the target day falls on a Saturday or Sunday, defers to the following Monday.
 */
export function getScheduledRunDate(
  targetDayOfMonth: number,
  referenceDate: Date = new Date()
): Date {
  const year = referenceDate.getUTCFullYear()
  const month = referenceDate.getUTCMonth()

  const target = new Date(Date.UTC(year, month, targetDayOfMonth))
  const dayOfWeek = target.getUTCDay() // 0=Sun, 6=Sat

  if (dayOfWeek === 6) {
    // Saturday → Monday
    target.setUTCDate(targetDayOfMonth + 2)
  } else if (dayOfWeek === 0) {
    // Sunday → Monday
    target.setUTCDate(targetDayOfMonth + 1)
  }

  return target
}

/**
 * Returns true if today (UTC) is the day the cron should actually run,
 * accounting for weekend deferral.
 */
export function isScheduledRunDay(
  targetDayOfMonth: number,
  now: Date = new Date()
): boolean {
  const scheduledDate = getScheduledRunDate(targetDayOfMonth, now)

  const todayStr = now.toISOString().slice(0, 10)
  const scheduledStr = scheduledDate.toISOString().slice(0, 10)

  return todayStr === scheduledStr
}

/**
 * Returns true if today (UTC) is the scheduled run day OR one of the
 * `windowDays - 1` days immediately after it, within the same month.
 *
 * This is the retry window: the cron fires on several consecutive days, but
 * only one of them is the "scheduled" day. If that day's run fails (e.g. the
 * database was briefly unreachable), the following day is still inside the
 * window, so — combined with the "already completed this month" guard — the
 * job retries instead of silently skipping until next month.
 */
export function isWithinRunWindow(
  targetDayOfMonth: number,
  now: Date = new Date(),
  windowDays = 3
): boolean {
  const scheduled = getScheduledRunDate(targetDayOfMonth, now)
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  )

  const diffDays = Math.floor(
    (today.getTime() - scheduled.getTime()) / 86_400_000
  )

  return (
    today.getUTCMonth() === scheduled.getUTCMonth() &&
    diffDays >= 0 &&
    diffDays < windowDays
  )
}

/** Format a Date to YYYY-MM (used as import_month / lead_month keys) */
export function toMonthKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 7)
}
