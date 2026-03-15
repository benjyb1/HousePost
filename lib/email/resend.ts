import { Resend } from 'resend'
import { formatMonthKey } from '@/lib/utils/date'

let _resend: Resend | null = null

function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY!)
  }
  return _resend
}

const FROM = process.env.RESEND_FROM_EMAIL ?? 'noreply@housepost.co.uk'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://housepost.co.uk'

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
    subject: `Your ${leadCount} new property leads are ready — ${monthLabel}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333;">
        <div style="background:#152452;color:white;padding:24px;border-radius:8px 8px 0 0;">
          <h1 style="margin:0;font-size:24px;">Your leads are ready</h1>
          <p style="margin:8px 0 0;opacity:0.9;">${monthLabel}</p>
        </div>
        <div style="padding:24px;background:#fff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">
          <p>Hi ${name},</p>
          <p>Your <strong>${leadCount} new property lead${leadCount === 1 ? '' : 's'}</strong> for <strong>${monthLabel}</strong> are now ready to review.</p>
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
            Additional postcards are charged at £1 each.
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
 * Send an alert to the admin email when the Land Registry import fails.
 */
export async function sendAdminImportFailureAlert(
  error: string,
  importMonth: string
): Promise<void> {
  const resend = getResend()
  const adminEmail = process.env.ADMIN_ALERT_EMAIL ?? FROM

  await resend.emails.send({
    from: FROM,
    to: adminEmail,
    subject: `[Housepost] Land Registry import failed — ${importMonth}`,
    html: `<p>The Land Registry import for <strong>${importMonth}</strong> failed.</p>
           <pre>${error}</pre>
           <p>Please retry manually via the admin panel or re-trigger the cron.</p>`,
  })
}
