import type { Metadata } from 'next'

// The page is a client component, which can't export metadata, so its tab
// title lives here. The root layout's template adds "| Housepost".
export const metadata: Metadata = {
  title: 'Create your account',
  description: 'Create a Housepost account and start posting to homes that have just sold near you.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
