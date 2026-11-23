import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import { PhoneViewButton } from '@/components/layout/PhoneViewButton'
import './globals.css'

const geist = Geist({ subsets: ['latin'] })

// The "Phone view" helper is for reviewing designs: Vercel preview builds and
// local development only, never production.
const showPhoneView = process.env.VERCEL_ENV === 'preview' || process.env.NODE_ENV === 'development'

export const metadata: Metadata = {
  title: 'Housepost',
  description: 'Automated UK property lead generation and postcard dispatch',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={geist.className}>
        {children}
        <Toaster richColors position="top-right" />
        {showPhoneView && <PhoneViewButton />}
      </body>
    </html>
  )
}
