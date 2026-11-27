import type { Metadata } from 'next'

// The page is a client component, which can't export metadata, so its tab
// title lives here. The root layout's template adds "| Housepost".
export const metadata: Metadata = {
  title: 'Designs',
  description: 'Choose a template, upload your own artwork or ask us to design your postcard.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
