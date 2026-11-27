import type { Metadata } from 'next'
import { Hanken_Grotesk } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

// Loaded as a variable font with no `weight` list: an explicit weight list
// makes Google serve per-weight "l/font?kit=" files, which breaks the Vercel
// Turbopack build.
const hanken = Hanken_Grotesk({ subsets: ['latin'], variable: '--font-hanken', display: 'swap' })

// Pages set a short title ("Sign in", "Account") and the template adds the
// brand. The homepage sits in this same segment, so the template doesn't touch
// its title. Relative URLs below resolve against metadataBase, and './' means
// "this page's own path", so every page gets its own canonical and og:url.
// og:title and og:description are left out on purpose: Next fills them from
// each page's own title and description.
export const metadata: Metadata = {
  metadataBase: new URL('https://www.housepost.co.uk'),
  title: { default: 'Housepost', template: '%s | Housepost' },
  description: 'Automated UK property lead generation and postcard dispatch',
  alternates: { canonical: './' },
  openGraph: {
    type: 'website',
    siteName: 'Housepost',
    locale: 'en_GB',
    url: './',
    images: [
      {
        url: '/home/og.jpg',
        width: 1200,
        height: 630,
        alt: 'Aerial view of terraced streets in an English town',
      },
    ],
  },
  twitter: { card: 'summary_large_image' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`scroll-smooth ${hanken.variable}`}>
      <body className="font-sans">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
