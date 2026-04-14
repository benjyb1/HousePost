export interface AddressResult {
  addressLine: string
  postcode: string
}

interface GetAddressResponse {
  postcode: string
  latitude: number
  longitude: number
  addresses: string[]
}

/**
 * Look up addresses for a UK postcode via getAddress.io.
 * Returns empty array if postcode is invalid or API key is missing.
 */
export async function lookupPostcode(postcode: string): Promise<AddressResult[]> {
  const apiKey = process.env.GETADDRESS_API_KEY
  if (!apiKey) return []

  const normalised = postcode.trim().toUpperCase()
  const url = `https://api.getaddress.io/find/${encodeURIComponent(normalised)}?api-key=${apiKey}&expand=false`

  const res = await fetch(url)
  if (!res.ok) {
    if (res.status === 404) return [] // invalid postcode
    if (res.status === 429) return [] // rate limited / quota exceeded
    throw new Error(`getAddress.io error: ${res.status}`)
  }

  const data: GetAddressResponse = await res.json()

  return data.addresses.map((raw) => {
    const parts = raw.split(',').map((p) => p.trim()).filter(Boolean)
    return {
      addressLine: parts.join(', '),
      postcode: data.postcode,
    }
  })
}
