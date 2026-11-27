'use client'

/*
  Development only, and only with ?mock=1 on /dev/designs: answers the saved-
  designs and settings calls with sample data, so the library can be looked at
  and tried (select, delete) without signing in. It patches fetch when this
  file loads, before any component asks for data. Nothing is saved anywhere.
*/
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production' && new URLSearchParams(window.location.search).has('mock')) {
  const o = window.location.origin
  const now = Date.now()
  const day = 864e5
  const designs = [
    { id: 'a', label: 'Linen template · 27 Nov', source: 'template', front_url: `${o}/home/aerial-terraces.jpg`, back_url: `${o}/home/letterbox.jpg`, created_at: new Date(now - 3600e3).toISOString() },
    { id: 'b', label: 'Uploaded design · 22 Sept', source: 'upload', front_url: `${o}/home/letterbox.jpg`, back_url: `${o}/hero-aerial.jpg`, created_at: new Date(now - 66 * day).toISOString() },
    { id: 'c', label: 'Studio template · 21 Sept', source: 'template', front_url: `${o}/hero-aerial.jpg`, back_url: null, created_at: new Date(now - 67 * day).toISOString() },
    { id: 'd', label: 'Bold template · 18 Sept', source: 'template', front_url: `${o}/logo-letterbox.png`, back_url: `${o}/home/aerial-terraces.jpg`, created_at: new Date(now - 70 * day).toISOString() },
    { id: 'e', label: 'Print-ready artwork', source: 'upload', front_url: `${o}/sample.pdf`, back_url: null, created_at: new Date(now - 400 * day).toISOString() },
  ]
  const gone = new Set<string>()
  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
  const real = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const method = (init?.method ?? 'GET').toUpperCase()
    if (url.includes('/api/postcards/designs')) {
      if (method === 'DELETE') {
        gone.add(new URL(url, o).searchParams.get('id') ?? '')
        return json({ success: true, removed: 1 })
      }
      return json({ designs: designs.filter((d) => !gone.has(d.id)) })
    }
    if (url.includes('/api/settings')) {
      if (method === 'PATCH') return json({ success: true })
      return json({ profile: { postcard_design_url: `${designs[0].front_url}?v=1`, postcard_design_back_url: designs[0].back_url } })
    }
    return real(input, init)
  }
}

export function MockApi() {
  return null
}
