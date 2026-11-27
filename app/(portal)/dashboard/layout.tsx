import type { Metadata } from 'next'

// The tab title for Home (the /dashboard route). The root layout's template
// turns it into "Home | Housepost".
export const metadata: Metadata = {
  title: 'Home',
  description: 'Homes that have just sold near you. Pick the ones worth a postcard.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
