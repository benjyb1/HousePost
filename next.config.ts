import type { NextConfig } from 'next'

// Sent with every response. No script Content-Security-Policy yet: Stripe,
// MapLibre and Next's own inline scripts would need testing against one first.
// frame-ancestors is the one CSP rule here, and it only stops other sites
// putting our pages in a frame (clickjacking), like X-Frame-Options.
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    // Checkout happens on Stripe's own page, so nothing here needs these.
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
  },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
]

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    // The hero photos ask for 65; everything else uses the default 75.
    qualities: [65, 75],
    // Optimised copies are kept a month; the source images rarely change, and
    // static imports get a new URL when they do.
    minimumCacheTTL: 2_678_400,
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      {
        // Files in public/ that ship with the site (photos, brand marks). They
        // aren't hashed, so cache for a day and check back after, rather than
        // re-checking on every page load.
        source: '/:dir(home|brand)/:file*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }],
      },
    ]
  },
}

export default nextConfig
