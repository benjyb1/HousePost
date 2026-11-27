import { notFound } from 'next/navigation'
import { HomeClient, type HomeLead } from '@/components/portal/home/HomeClient'
import { AppBar } from '@/components/portal/AppBar'
import { LeaveGuardProvider } from '@/components/layout/LeaveGuardProvider'

/** The same "random" homes on every load. */
function seededRandom(start: number) {
  let seed = start
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
}

// Development-only: Home with example homes and no sign-in, for screenshots.
// Never served in production.
// ?n=2000 makes that many homes (to try Select all on a big list); ?r=15 sets the
// saved distance (to see an older search wider than 10 miles).
export default async function DevHome({ searchParams }: { searchParams: Promise<{ n?: string; r?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound()
  const q = await searchParams
  const count = Math.min(Math.max(Number(q.n) || 20, 1), 5000)
  const savedRadius = Number(q.r) || 5

  const office = { lat: 51.1853, lng: -0.6126 }
  const streets = ['Mill Pond Row', 'Wey Terrace', 'Larkfield Road', 'Rectory Gardens', 'Holloway Hill', 'Orchard Rise', 'Station Mews', 'Meadrow Close',
    'Ockford Ridge', 'Busbridge Lane', 'Hurtmore Walk', 'Pepper Lane', 'Chalk Lane', 'Frith Hill Road', 'Croft Terrace', 'Nightingale Way', 'Tuesley Lane', 'Elm Walk', 'Summers Rise', 'Bridge Street']
  const types = ['T', 'T', 'S', 'D', 'S', 'D', 'F']
  const rand = seededRandom(7)
  const leads: HomeLead[] = Array.from({ length: count }, (_, i) => {
    const st = streets[i % streets.length]
    const ang = rand() * Math.PI * 2
    const dist = 0.2 + rand() * (count > 20 ? 9.7 : 4.6)
    return {
      id: `dev-${i}`,
      addressLine: `${1 + i} ${st}, Godalming`,
      postcode: `GU7 ${1 + Math.floor(rand() * 3)}${'ABDEFHJLNPQ'[i % 11]}${'RSTUWXYZ'[i % 8]}`,
      price: Math.round((420000 + rand() * 1600000) / 5000) * 5000 * 100,
      propertyType: types[i % types.length],
      distance: Math.round(dist * 10) / 10,
      soldOn: `2026-${i % 3 ? '10' : '09'}-${String(1 + Math.floor(rand() * 27)).padStart(2, '0')}`,
      month: i % 3 ? '2026-11' : '2026-10',
      jobId: null,
      custom: false,
      lat: office.lat + (dist / 69) * Math.sin(ang),
      lng: office.lng + (dist / (69 * Math.cos((office.lat * Math.PI) / 180))) * Math.cos(ang),
    }
  })

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <LeaveGuardProvider>
        <AppBar initials="HC" unread />
        <main className="flex-1">
          <HomeClient
            userId="dev"
            leads={leads}
            prefs={{ radius: savedRadius, min: count > 20 ? null : 40000000, max: count > 20 ? null : 250000000, types: ['D', 'S', 'T', 'F', 'O'] }}
            office={office}
            subscribed
            frontUrl={null}
            backUrl={null}
            used={1}
          />
        </main>
      </LeaveGuardProvider>
    </div>
  )
}
