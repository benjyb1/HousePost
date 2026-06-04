const POSTGRID_BASE = 'https://api.postgrid.com/print-mail/v1'

// PostGrid contacts are flat — address fields live directly on the contact object
export interface PostGridContact {
  firstName: string
  lastName?: string
  companyName?: string
  addressLine1: string
  city: string
  postalOrZip: string
  countryCode: 'GB'
}

interface CreatePostcardResponse {
  id: string
  status: string
  object: string
}

interface GetPostcardResponse {
  id: string
  status: string
  // PostGrid renders a print-ready PDF a few seconds after the order is created
  // and exposes it here. This is the exact artwork the printer uses.
  url?: string
}

async function postGridRequest<T>(
  method: 'GET' | 'POST',
  path: string,
  body?: Record<string, unknown>,
  idempotencyKey?: string,
  apiKey?: string
): Promise<T> {
  const url = `${POSTGRID_BASE}${path}`
  const headers: Record<string, string> = {
    'x-api-key': apiKey ?? process.env.POSTGRID_API_KEY!,
    'Content-Type': 'application/json',
  }
  // PostGrid dedupes POSTs that carry the same Idempotency-Key, so a double-click
  // or retry can't print and post the same card twice.
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey
  const response = await fetch(url, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(
      `PostGrid API error ${response.status}: ${JSON.stringify(data)}`
    )
  }
  return data as T
}

function getSenderContact(): PostGridContact {
  return {
    companyName: process.env.POSTGRID_SENDER_NAME ?? 'Housepost',
    firstName: process.env.POSTGRID_SENDER_NAME ?? 'Housepost',
    addressLine1: process.env.POSTGRID_SENDER_ADDRESS_LINE1 ?? '1 Example Street',
    city: process.env.POSTGRID_SENDER_CITY ?? 'London',
    postalOrZip: process.env.POSTGRID_SENDER_POSTAL_CODE ?? 'EC1A 1BB',
    countryCode: 'GB',
  }
}

/**
 * Parse a UK address line and postcode into a PostGridContact.
 * The addressLine is expected to be "PAON SAON Street, Locality, Town".
 */
export function buildRecipientContact(
  addressLine: string,
  postcode: string,
  recipientName = 'The Homeowner'
): PostGridContact {
  const [firstName, ...rest] = recipientName.split(' ')
  // The Land Registry address line is "SAON, PAON, Street, Locality, Town", so
  // the post town is the last comma-separated segment. Use that rather than a
  // hardcoded "London" (most recipients aren't in London). PostGrid wants a
  // non-empty city, so for a comma-less line we fall back to the whole line
  // (PostGrid verifies and corrects against the postcode anyway).
  const segments = addressLine.split(',').map((s) => s.trim()).filter(Boolean)
  const city = segments.length > 0 ? segments[segments.length - 1] : addressLine.trim()
  return {
    firstName,
    lastName: rest.join(' ') || undefined,
    addressLine1: addressLine,
    city,
    postalOrZip: postcode,
    countryCode: 'GB',
  }
}

/**
 * Send a postcard via PostGrid using the postcards API with frontHTML and backHTML.
 * Returns the PostGrid postcard ID and status.
 */
export async function sendPostcard(
  to: PostGridContact,
  frontHtml: string,
  backHtml: string,
  size: '6x4' | '4x6' | '6x9' | '6x11' = '6x4',
  idempotencyKey?: string
): Promise<{ postcardId: string; status: string }> {
  const from = getSenderContact()

  const result = await postGridRequest<CreatePostcardResponse>('POST', '/postcards', {
    to,
    from,
    frontHTML: frontHtml,
    backHTML: backHtml,
    size,
    mailingClass: 'royal_mail_second_class',
  }, idempotencyKey)

  return { postcardId: result.id, status: result.status }
}

/**
 * Get the current status of a PostGrid postcard.
 */
export async function getPostcardStatus(postcardId: string): Promise<string> {
  const result = await postGridRequest<GetPostcardResponse>(
    'GET',
    `/postcards/${postcardId}`
  )
  return result.status
}

/**
 * Create a postcard in PostGrid's TEST sandbox and return the URL of the
 * rendered PDF proof — the exact artwork the printer would use. Test-mode
 * orders are never printed, never posted and never charged, so this is safe to
 * call for an on-screen "what will actually print" preview.
 *
 * Requires POSTGRID_TEST_API_KEY (the test key from PostGrid → Settings). We use
 * a dedicated test key rather than POSTGRID_API_KEY so a preview can never touch
 * the live mailing/billing path, regardless of which key dispatch runs on.
 */
export async function createPostcardPreview(
  to: PostGridContact,
  frontHtml: string,
  backHtml: string,
  size: '6x4' | '4x6' | '6x9' | '6x11' = '6x4'
): Promise<{ url: string }> {
  const testKey = process.env.POSTGRID_TEST_API_KEY
  if (!testKey) {
    throw new Error('POSTGRID_TEST_API_KEY is not set')
  }
  if (!testKey.startsWith('test_')) {
    // Guard against someone pasting a live key here — a live key would print and
    // post a real card and charge for it.
    throw new Error('POSTGRID_TEST_API_KEY must be a test key (starts with "test_")')
  }

  const created = await postGridRequest<CreatePostcardResponse>(
    'POST',
    '/postcards',
    {
      to,
      from: getSenderContact(),
      frontHTML: frontHtml,
      backHTML: backHtml,
      size,
    },
    undefined,
    testKey
  )

  // The proof PDF appears a few seconds after creation, so poll for it.
  for (let attempt = 0; attempt < 12; attempt++) {
    const result = await postGridRequest<GetPostcardResponse>(
      'GET',
      `/postcards/${created.id}`,
      undefined,
      undefined,
      testKey
    )
    if (result.url) return { url: result.url }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  throw new Error('PostGrid preview did not render in time — please try again')
}

/**
 * Generate HTML for the front of a postcard.
 * If the user has a custom design, embed it as a full-bleed image.
 * Otherwise use a default template.
 */
export function generateFrontHtml(params: {
  senderName: string
  designUrl?: string | null
}): string {
  const { senderName, designUrl } = params

  if (designUrl) {
    return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;">
  <img src="${designUrl}" style="width:100%;height:100%;display:block;object-fit:cover;" alt="Postcard design"/>
</body>
</html>`
  }

  // Default front when no custom design uploaded
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
    .front { width: 100%; height: 100%; background: #152452; color: white; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 20px; box-sizing: border-box; }
    .logo { font-size: 28px; font-weight: bold; margin-bottom: 8px; }
    .tagline { font-size: 14px; opacity: 0.8; }
    .sender { font-size: 12px; margin-top: 16px; opacity: 0.6; }
  </style>
</head>
<body>
  <div class="front">
    <div class="logo">Housepost</div>
    <div class="tagline">Your local property specialists</div>
    <div class="sender">From ${senderName}</div>
  </div>
</body>
</html>`
}

/**
 * Generate HTML for the back of a postcard.
 * Contains the marketing message with property sale details.
 * If the user has a custom back design, use that instead.
 */
export function generateBackHtml(params: {
  recipientAddress: string
  price: number | null
  propertyType: string | null
  saleDate: string | null
  senderName: string
  backDesignUrl?: string | null
}): string {
  const { recipientAddress, price, propertyType, saleDate, senderName, backDesignUrl } = params
  const hasSaleData = price != null && propertyType && saleDate
  const formattedPrice = price != null ? `£${(price / 100).toLocaleString('en-GB')}` : ''

  if (backDesignUrl) {
    // The design occupies the left half; the right half is left blank for the
    // address block and postage that PostGrid prints on the address side. The
    // uploaded image is already cropped to the left-half-plus-bleed aspect
    // (3.125x4.25in: half the 6in trim + 0.125in bleed wide, full 4.25in tall).
    // width:50% maps exactly onto that, since 3.125 / 6.25 = 0.5.
    return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;">
  <div style="width:100%;height:100%;display:flex;">
    <img src="${backDesignUrl}" style="width:50%;height:100%;display:block;object-fit:cover;" alt="Postcard back design"/>
    <div style="width:50%;height:100%;"></div>
  </div>
</body>
</html>`
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 0; color: #333; font-size: 11px; }
    .content { width: 50%; height: 100%; padding: 20px; box-sizing: border-box; }
    .header { font-size: 16px; font-weight: bold; color: #152452; margin-bottom: 12px; }
    .highlight { color: #152452; font-weight: bold; }
    .sale-info { background: #f0f4fa; border-left: 3px solid #152452; padding: 8px 12px; margin: 12px 0; font-size: 10px; }
    .cta { margin-top: 12px; font-weight: bold; }
    .footer { margin-top: 16px; font-size: 9px; color: #999; border-top: 1px solid #e2e8f0; padding-top: 8px; }
  </style>
</head>
<body>
  <div class="content">
  <div class="header">${hasSaleData ? 'A property near you recently sold' : 'Considering selling your property?'}</div>

  <p>Dear Homeowner,</p>

  ${hasSaleData ? `<p>A property on your street recently sold for <span class="highlight">${formattedPrice}</span>.
  As local property specialists, we're working with buyers actively searching in your area.</p>

  <div class="sale-info">
    <strong>Recent sale nearby:</strong><br/>
    ${recipientAddress}<br/>
    <strong>Price:</strong> ${formattedPrice} · <strong>Type:</strong> ${propertyType} · <strong>Date:</strong> ${saleDate}
  </div>` : `<p>As local property specialists, we're working with buyers actively searching in your area and would love to help if you're considering selling.</p>`}

  <p class="cta">Thinking of selling? Get in touch for a free, no-obligation appraisal.</p>

  <p>Best regards,<br/><strong>${senderName}</strong></p>

  <div class="footer">
    Sent by Housepost on behalf of ${senderName}.
    To opt out of future mailings, please contact us.
  </div>
  </div>
</body>
</html>`
}
