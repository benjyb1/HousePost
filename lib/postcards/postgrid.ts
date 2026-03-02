const POSTGRID_BASE = 'https://api.postgrid.com/print-mail/v1'

export interface PostGridAddress {
  addressLine1: string
  city: string
  postalOrZip: string
  countryCode: 'GB'
}

export interface PostGridContact {
  firstName: string
  lastName?: string
  companyName?: string
  address: PostGridAddress
}

interface CreateLetterResponse {
  id: string
  status: string
  object: string
}

interface GetLetterResponse {
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
    companyName: process.env.POSTGRID_SENDER_NAME ?? 'PropertyLeads',
    firstName: process.env.POSTGRID_SENDER_NAME ?? 'PropertyLeads',
    address: {
      addressLine1: process.env.POSTGRID_SENDER_ADDRESS_LINE1 ?? '1 Example Street',
      city: process.env.POSTGRID_SENDER_CITY ?? 'London',
      postalOrZip: process.env.POSTGRID_SENDER_POSTAL_CODE ?? 'EC1A 1BB',
      countryCode: 'GB',
    },
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
  // Use "The Homeowner" as the default recipient name for UK postcards
  const [firstName, ...rest] = recipientName.split(' ')
  return {
    firstName,
    lastName: rest.join(' ') || undefined,
    address: {
      addressLine1: addressLine,
      city: 'London', // Required by PostGrid even for UK addresses
      postalOrZip: postcode,
      countryCode: 'GB',
    },
  }
}

/**
 * Send a letter via PostGrid using raw HTML content.
 * Returns the PostGrid letter ID and status.
 */
export async function sendLetter(
  to: PostGridContact,
  htmlContent: string
): Promise<{ letterId: string; status: string }> {
  const from = getSenderContact()

  const result = await postGridRequest<CreateLetterResponse>('POST', '/letters', {
    to,
    from,
    html: htmlContent,
    color: true,
    doubleSided: false,
    addressPlacement: 'insert_blank_page',
  })

  return { letterId: result.id, status: result.status }
}

/**
 * Get the current status of a PostGrid letter.
 */
export async function getLetterStatus(letterId: string): Promise<string> {
  const result = await postGridRequest<GetLetterResponse>(
    'GET',
    `/letters/${letterId}`
  )
  return result.status
}

/**
 * Generate HTML content for a postcard letter.
 * If the client has uploaded a design URL, use it; otherwise use a default template.
 */
export function generateLetterHtml(params: {
  recipientAddress: string
  price: number
  propertyType: string
  saleDate: string
  senderName: string
  designUrl?: string | null
}): string {
  const { recipientAddress, price, propertyType, saleDate, senderName, designUrl } =
    params
  const formattedPrice = `£${(price / 100).toLocaleString('en-GB')}`

  if (designUrl) {
    // Embed their custom design with address variable injected
    return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;">
  <img src="${designUrl}" style="width:100%;display:block;" alt="Postcard design"/>
  <div style="position:absolute;bottom:20px;right:20px;font-family:Arial;font-size:10px;color:#666;">
    Sent by ${senderName}
  </div>
</body>
</html>`
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
    .header { background: #1a365d; color: white; padding: 20px; border-radius: 8px; margin-bottom: 24px; }
    .highlight { color: #2b6cb0; font-weight: bold; }
    .address { background: #f7fafc; border-left: 4px solid #2b6cb0; padding: 12px 16px; margin: 16px 0; }
    .footer { margin-top: 32px; font-size: 12px; color: #666; border-top: 1px solid #e2e8f0; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin:0;font-size:22px;">Your Home Recently Sold</h1>
    <p style="margin:8px 0 0;opacity:0.9;">We're active in your area</p>
  </div>

  <p>Dear Homeowner,</p>

  <p>A property on your street recently sold for <span class="highlight">${formattedPrice}</span>.
  As local property specialists, we're currently working with buyers actively searching in your area.</p>

  <div class="address">
    <strong>Recent sale nearby:</strong><br/>
    ${recipientAddress}<br/>
    <strong>Sale price:</strong> ${formattedPrice}<br/>
    <strong>Type:</strong> ${propertyType}<br/>
    <strong>Date:</strong> ${saleDate}
  </div>

  <p>If you're considering selling, now could be an excellent time.
  We'd love to provide you with a free, no-obligation market appraisal.</p>

  <p>Please don't hesitate to get in touch.</p>

  <p>Warm regards,<br/><strong>${senderName}</strong></p>

  <div class="footer">
    This letter was sent to you because a property near your address was recently sold.
    To opt out of future mailings, please contact us.
  </div>
</body>
</html>`
}
