import type { Metadata } from 'next'

// The page is a client component, which can't export metadata, so its tab
// title lives here. The root layout's template adds "| Housepost".
export const metadata: Metadata = {
  title: 'Reset your password',
  description: 'Get a link to choose a new Housepost password.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
