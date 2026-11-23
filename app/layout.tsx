import type { Metadata } from 'next'
import { Hanken_Grotesk } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

// Loaded as a variable font with no `weight` list: an explicit weight list
// makes Google serve per-weight "l/font?kit=" files, which breaks the Vercel
// Turbopack build.
const hanken = Hanken_Grotesk({ subsets: ['latin'], variable: '--font-hanken', display: 'swap' })

export const metadata: Metadata = {
  title: 'Housepost',
  description: 'Automated UK property lead generation and postcard dispatch',
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
