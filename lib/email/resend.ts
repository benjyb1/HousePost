import { Resend } from 'resend'
import { formatMonthKey } from '@/lib/utils/date'

let _resend: Resend | null = null

function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY!)
  }
  return _resend
}

const FROM = process.env.RESEND_FROM_EMAIL ?? 'info@housepost.co.uk'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://housepost.co.uk'

// Escape values that are interpolated into email HTML so a name/title/body
// containing markup can't inject arbitrary HTML into the message.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Send the monthly "your leads are ready" notification email.
 */
export async function sendLeadsReadyEmail(params: {
  to: string
  name: string
  leadCount: number
  monthKey: string
  hitMaxRadius: boolean
  radiusUsed: number
}): Promise<void> {
  const { to, name, leadCount, monthKey, hitMaxRadius, radiusUsed } = params
  const resend = getResend()
  const monthLabel = formatMonthKey(monthKey)

  const warningHtml = hitMaxRadius
    ? `<p style="color:#c53030;background:#fff5f5;border:1px solid #fed7d7;padding:12px;border-radius:6px;">
        ⚠️ We expanded the search radius to ${radiusUsed} miles to find enough properties.
        If you'd like to adjust your preferences, visit your
        <a href="${APP_URL}/settings">settings page</a>.
      </p>`
    : ''

  await resend.emails.send({
    from: FROM,
    to,
    subject: `Your ${leadCount} new leads are ready — ${monthLabel}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333;">
        <div style="background:#152452;color:white;padding:24px;border-radius:8px 8px 0 0;">
          <h1 style="margin:0;font-size:24px;">Your leads are ready</h1>
          <p style="margin:8px 0 0;opacity:0.9;">${monthLabel}</p>
        </div>
        <div style="padding:24px;background:#fff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">
          <p>Hi ${name},</p>
          <p>Your <strong>${leadCount} new lead${leadCount === 1 ? '' : 's'}</strong> for <strong>${monthLabel}</strong> are now ready to review.</p>
          ${warningHtml}
          <p>Log in to your portal to view, sort, and select which properties to send postcards to.</p>
          <div style="text-align:center;margin:32px 0;">
            <a href="${APP_URL}/leads"
               style="background:#152452;color:white;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;">
              View My Leads
            </a>
          </div>
          <p style="color:#666;font-size:13px;">
            Remember: your plan includes 5 free postcards per month.
            Additional postcards are charged at £1.50 each.
          </p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;"/>
          <p style="color:#999;font-size:12px;">
            Housepost · <a href="${APP_URL}/settings" style="color:#999;">Manage preferences</a>
          </p>
        </div>
      </div>
    `,
  })
}

/**
 * Send a general notification email.
 *
 * This is the email side of the in-app notifications feed: when
 * `createNotification` writes a row and the target user has
 * `email_notifications` enabled, this sends a matching email. Styled to match
 * `sendLeadsReadyEmail` (same header band + primary button).
 *
 * The subject is derived from the notification title (e.g. "25 new leads just
 * dropped"), and the button links to the notification's `href` (falling back to
 * the dashboard). A quiet footer line reminds the user they can turn these
 * emails off in Settings.
 */
export async function sendNotificationEmail(params: {
  to: string
  name: string
  title: string
  body?: string | null
  href?: string | null
}): Promise<void> {
  const { to, name, title, body, href } = params
  const resend = getResend()

  // Resolve the button target and its label. Relative hrefs (e.g. '/leads')
  // are joined onto APP_URL; anything else falls back to the dashboard.
  const path = href && href.startsWith('/') ? href : '/dashboard'
  const buttonHref = `${APP_URL}${path}`
  const buttonLabel = path === '/dashboard' ? 'Go to dashboard' : 'View in Housepost'

  const bodyHtml = body
    ? `<p>${escapeHtml(body)}</p>`
    : ''

  await resend.emails.send({
    from: FROM,
    to,
    subject: title,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333;">
        <div style="background:#152452;color:white;padding:24px;border-radius:8px 8px 0 0;">
          <h1 style="margin:0;font-size:24px;">${escapeHtml(title)}</h1>
        </div>
        <div style="padding:24px;background:#fff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">
          <p>Hi ${escapeHtml(name)},</p>
          ${bodyHtml}
          <div style="text-align:center;margin:32px 0;">
            <a href="${buttonHref}"
               style="background:#152452;color:white;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;">
              ${buttonLabel}
            </a>
          </div>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;"/>
          <p style="color:#999;font-size:12px;">
            You're receiving this because email notifications are switched on.
            You can turn these emails off any time in your
            <a href="${APP_URL}/settings" style="color:#999;">settings</a>.
          </p>
        </div>
      </div>
    `,
  })
}

/**
 * Send an alert to the admin email when the Land Registry import fails.
 */
export async function sendAdminImportFailureAlert(
  error: string,
  importMonth: string
): Promise<void> {
  await sendAdminAlert(
    `[Housepost] Land Registry import failed — ${importMonth}`,
    `<p>The Land Registry import for <strong>${importMonth}</strong> failed.</p>
     <pre>${error}</pre>
     <p>Please retry manually via the admin panel or re-trigger the cron.</p>`
  )
}

/**
 * Send an arbitrary alert to the admin email. Used for any pipeline anomaly
 * that needs a human — a failed run, or a run that completed but produced
 * nothing (which previously looked identical to a healthy quiet month).
 */
export async function sendAdminAlert(
  subject: string,
  bodyHtml: string
): Promise<void> {
  const resend = getResend()
  const adminEmail = process.env.ADMIN_ALERT_EMAIL ?? FROM

  await resend.emails.send({
    from: FROM,
    to: adminEmail,
    subject,
    html: bodyHtml,
  })
}
