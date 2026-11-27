import { notFound } from 'next/navigation'
import { LeaveGuardProvider } from '@/components/layout/LeaveGuardProvider'
import PostcardDesignPage from '@/app/(portal)/postcards/design/page'
import { MockApi } from './mock-api'

// Dev-only fixture: the Designs page outside the portal layout, for
// screenshots. 404s in production. Saved designs and settings come from the
// real API routes, so it shows whichever account the browser is signed in to
// (and the empty states when signed out). Look, don't press Save: it is live.
// Add ?mock=1 for sample saved designs instead (see mock-api.tsx).
export default function DevDesignsPage() {
  if (process.env.NODE_ENV === 'production') notFound()
  return (
    <div className="min-h-screen bg-paper text-ink">
      <MockApi />
      <LeaveGuardProvider>
        <PostcardDesignPage />
      </LeaveGuardProvider>
    </div>
  )
}
