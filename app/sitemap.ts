import type { MetadataRoute } from 'next'

const BASE = 'https://www.housepost.co.uk'

// Public pages only. The signed-in portal is blocked in robots.ts.
export default function sitemap(): MetadataRoute.Sitemap {
  const pages: { path: string; changeFrequency: 'weekly' | 'monthly' | 'yearly'; priority: number }[] = [
    { path: '/', changeFrequency: 'weekly', priority: 1 },
    { path: '/houses-sold', changeFrequency: 'monthly', priority: 0.8 },
    { path: '/help', changeFrequency: 'monthly', priority: 0.5 },
    { path: '/privacy', changeFrequency: 'yearly', priority: 0.3 },
    { path: '/opt-out', changeFrequency: 'yearly', priority: 0.3 },
    { path: '/login', changeFrequency: 'yearly', priority: 0.4 },
    { path: '/signup', changeFrequency: 'yearly', priority: 0.6 },
  ]
  return pages.map(({ path, changeFrequency, priority }) => ({
    url: path === '/' ? BASE : `${BASE}${path}`,
    changeFrequency,
    priority,
  }))
}
