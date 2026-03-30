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
}

async function postGridRequest<T>(
  method: 'GET' | 'POST',
  path: string,
  body?: Record<string, unknown>
): Promise<T> {
  const url = `${POSTGRID_BASE}${path}`
  const response = await fetch(url, {
    method,
    headers: {
      'x-api-key': process.env.POSTGRID_API_KEY!,
      'Content-Type': 'application/json',
    },
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
  return {
    firstName,
    lastName: rest.join(' ') || undefined,
    addressLine1: addressLine,
    city: 'London', // Required by PostGrid even for UK addresses
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
  size: '6x4' | '4x6' | '6x9' | '6x11' = '6x4'
): Promise<{ postcardId: string; status: string }> {
  const from = getSenderContact()

  const result = await postGridRequest<CreatePostcardResponse>('POST', '/postcards', {
    to,
    from,
    frontHTML: frontHtml,
    backHTML: backHtml,
    size,
    mailingClass: 'second_class',
  })

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
  price: number
  propertyType: string
  saleDate: string
  senderName: string
  backDesignUrl?: string | null
}): string {
  const { recipientAddress, price, propertyType, saleDate, senderName, backDesignUrl } = params
  const formattedPrice = `£${(price / 100).toLocaleString('en-GB')}`

  if (backDesignUrl) {
    return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;">
  <img src="${backDesignUrl}" style="width:100%;height:100%;display:block;object-fit:cover;" alt="Postcard back design"/>
</body>
</html>`
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #333; font-size: 11px; }
    .header { font-size: 16px; font-weight: bold; color: #152452; margin-bottom: 12px; }
    .highlight { color: #152452; font-weight: bold; }
    .sale-info { background: #f0f4fa; border-left: 3px solid #152452; padding: 8px 12px; margin: 12px 0; font-size: 10px; }
    .cta { margin-top: 12px; font-weight: bold; }
    .footer { margin-top: 16px; font-size: 9px; color: #999; border-top: 1px solid #e2e8f0; padding-top: 8px; }
  </style>
</head>
<body>
  <div class="header">A property near you recently sold</div>

  <p>Dear Homeowner,</p>

  <p>A property on your street recently sold for <span class="highlight">${formattedPrice}</span>.
  As local property specialists, we're working with buyers actively searching in your area.</p>

  <div class="sale-info">
    <strong>Recent sale nearby:</strong><br/>
    ${recipientAddress}<br/>
    <strong>Price:</strong> ${formattedPrice} · <strong>Type:</strong> ${propertyType} · <strong>Date:</strong> ${saleDate}
  </div>

  <p class="cta">Thinking of selling? Get in touch for a free, no-obligation appraisal.</p>

  <p>Best regards,<br/><strong>${senderName}</strong></p>

  <div class="footer">
    Sent by Housepost on behalf of ${senderName}.
    To opt out of future mailings, please contact us.
  </div>
</body>
</html>`
}
