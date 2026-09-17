// Turn a dispatch error into something three audiences can use:
//
//   * the customer, who must never see the print supplier's name or raw API
//     text, only what happened to their card and what (if anything) to do;
//   * the operator, who needs the raw error and a category to act on;
//   * the release cron, which needs to know whether to retry (a problem on our
//     side that will clear, such as an empty print balance) or to fail the card
//     for good and make the customer whole (a bad address or unusable design).
//
// Keep this module free of imports so it can be unit-tested in isolation.

export type FailureCategory =
  | 'print_credit' // the prepaid print balance is empty
  | 'printer' // the print supplier is down, slow, or refused us (not this card)
  | 'address' // this recipient address cannot be posted to
  | 'design' // the artwork could not be fetched or printed
  | 'unknown'

export interface ClassifiedFailure {
  category: FailureCategory
  /** True when the problem is on our side and the same card can be retried. */
  retryable: boolean
  /** Shown to the customer while the card is queued to retry. */
  delayedMessage: string
  /** Shown to the customer once the card is finally failed and unwound. */
  failedMessage: string
}

const OUR_SIDE_DELAYED =
  'There is a temporary problem on our side with printing. Your postcard is queued and will be sent automatically once it clears. You have not been charged anything extra.'

const OUR_SIDE_FAILED =
  'We could not print this postcard after several attempts, so it has not been sent. Any charge for it has been refunded and the lead is back in your list, so you can send it again later.'

const MESSAGES: Record<FailureCategory, Pick<ClassifiedFailure, 'retryable' | 'delayedMessage' | 'failedMessage'>> = {
  print_credit: {
    retryable: true,
    delayedMessage: OUR_SIDE_DELAYED,
    failedMessage: OUR_SIDE_FAILED,
  },
  printer: {
    retryable: true,
    delayedMessage: OUR_SIDE_DELAYED,
    failedMessage: OUR_SIDE_FAILED,
  },
  unknown: {
    retryable: true,
    delayedMessage: OUR_SIDE_DELAYED,
    failedMessage: OUR_SIDE_FAILED,
  },
  address: {
    retryable: false,
    delayedMessage: OUR_SIDE_DELAYED,
    failedMessage:
      'The address on this postcard could not be used for posting, so it has not been sent. Any charge for it has been refunded. Check the address, then send again.',
  },
  design: {
    retryable: false,
    delayedMessage: OUR_SIDE_DELAYED,
    failedMessage:
      'Your postcard design could not be printed, so this card has not been sent. Any charge for it has been refunded. Open Postcard Design, check both sides, then send again.',
  },
}

/**
 * Classify a raw dispatch error message. Order matters: the specific,
 * account-level signals come first so an "insufficient funds" 400 is never
 * mistaken for a bad address just because the text also mentions a recipient.
 */
export function classifyDispatchError(raw: string | null | undefined): ClassifiedFailure {
  const text = (raw ?? '').toLowerCase()
  let category: FailureCategory = 'unknown'

  if (/insufficient funds|insufficient balance|no credit|top up/.test(text)) {
    category = 'print_credit'
  } else if (
    /api key is not set|unauthori[sz]ed|forbidden|invalid api key|\b401\b|\b403\b/.test(text)
  ) {
    // Our credentials, not this card. Operator must fix; retrying is harmless.
    category = 'printer'
  } else if (
    /wrong file extension|design snapshot|could not (download|fetch|load|open) (the )?(file|image|pdf|artwork)|unsupported (file|image)|corrupt|invalid (pdf|image)|file (too large|size)|\bfront\b.*(invalid|missing)|\bback\b.*(invalid|missing)/.test(
      text
    )
  ) {
    category = 'design'
  } else if (/address|postcode|post code|recipient|city|town|country/.test(text)) {
    category = 'address'
  } else if (
    /non-json|fetch failed|econnreset|etimedout|enotfound|timeout|timed out|socket|network|\b5\d\d\b|\b429\b|rate limit|temporarily|maintenance|unavailable/.test(
      text
    )
  ) {
    category = 'printer'
  }

  return { category, ...MESSAGES[category] }
}

/**
 * Minutes to wait before the n-th retry (1-based). Starts at the cool-off
 * length so a delayed card feels like "a bit longer", then backs off to a few
 * hours. After MAX_RETRIES the card is failed and the customer made whole.
 */
export function retryDelayMinutes(retryNumber: number): number {
  const ladder = [15, 30, 60, 120, 240]
  return ladder[Math.min(Math.max(retryNumber, 1), ladder.length) - 1]
}

/** Roughly 36 hours of retries at the ladder above before giving up. */
export const MAX_RETRIES = 12

/** Label for the ops page. Plain words, no supplier name. */
export function describeCategory(category: string | null | undefined): string {
  switch (category) {
    case 'print_credit':
      return 'Print balance empty'
    case 'printer':
      return 'Printer unavailable'
    case 'address':
      return 'Address rejected'
    case 'design':
      return 'Design could not be printed'
    default:
      return 'Unknown'
  }
}
