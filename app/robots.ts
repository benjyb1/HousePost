import type { MetadataRoute } from 'next'

// The signed-in portal, admin, dev previews, auth callbacks and the API have
// nothing for a search engine. Keep the portal list in step with the folders
// in app/(portal) and PORTAL_PATHS in proxy.ts.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/admin',
        '/dev',
        '/auth/',
        '/reset-password',
        '/dashboard',
        '/leads',
        '/postcards',
        '/settings',
        '/account',
        '/billing',
        '/notifications',
      ],
    },
    sitemap: 'https://www.housepost.co.uk/sitemap.xml',
    host: 'https://www.housepost.co.uk',
  }
}
