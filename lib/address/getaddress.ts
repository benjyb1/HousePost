export interface AddressResult {
  addressLine: string
  postcode: string
}

interface IdealPostcodesAddress {
  line_1: string
  line_2: string
  line_3: string
  post_town: string
  postcode: string
}

interface IdealPostcodesResponse {
  result: IdealPostcodesAddress[]
  code: number
  message: string
  total: number
}

/**
 * Look up addresses for a UK postcode via Ideal Postcodes.
 * Returns empty array if postcode is invalid or API key is missing.
 */
export async function lookupPostcode(postcode: string): Promise<AddressResult[]> {
  const apiKey = process.env.IDEAL_POSTCODES_API_KEY
  if (!apiKey) return []

  const normalised = postcode.trim().replace(/\s/g, '').toUpperCase()
  const url = `https://api.ideal-postcodes.co.uk/v1/postcodes/${encodeURIComponent(normalised)}?api_key=${apiKey}`

  const res = await fetch(url)
  if (!res.ok) {
    if (res.status === 404) return [] // invalid postcode
    if (res.status === 429) return [] // rate limited
    throw new Error(`Ideal Postcodes error: ${res.status}`)
  }

  const data: IdealPostcodesResponse = await res.json()

  if (data.code !== 2000) return []

  return data.result.map((addr) => {
    const parts = [addr.line_1, addr.line_2, addr.line_3, addr.post_town]
      .filter(Boolean)
    return {
      addressLine: parts.join(', '),
      postcode: addr.postcode,
    }
  })
}
