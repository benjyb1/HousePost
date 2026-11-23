import { notFound } from 'next/navigation'
import { HomeClient, type HomeLead } from '@/components/portal/home/HomeClient'
import { AppBar } from '@/components/portal/AppBar'
import { LeaveGuardProvider } from '@/components/layout/LeaveGuardProvider'

// Development-only: Home with example homes and no sign-in, for screenshots.
// Never served in production.
export default function DevHome() {
  if (process.env.NODE_ENV === 'production') notFound()

  const office = { lat: 51.1853, lng: -0.6126 }
  const streets = ['Mill Pond Row', 'Wey Terrace', 'Larkfield Road', 'Rectory Gardens', 'Holloway Hill', 'Orchard Rise', 'Station Mews', 'Meadrow Close',
    'Ockford Ridge', 'Busbridge Lane', 'Hurtmore Walk', 'Pepper Lane', 'Chalk Lane', 'Frith Hill Road', 'Croft Terrace', 'Nightingale Way', 'Tuesley Lane', 'Elm Walk', 'Summers Rise', 'Bridge Street']
  const types = ['T', 'T', 'S', 'D', 'S', 'D', 'F']
  let seed = 7
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
  const leads: HomeLead[] = streets.map((st, i) => {
    const ang = rand() * Math.PI * 2
    const dist = 0.2 + rand() * 4.6
    return {
      id: `dev-${i}`,
      addressLine: `${1 + Math.floor(rand() * 60)} ${st}, Godalming`,
      postcode: `GU7 ${1 + Math.floor(rand() * 3)}${'ABDEFHJLNPQ'[i % 11]}${'RSTUWXYZ'[i % 8]}`,
      price: Math.round((420000 + rand() * 1600000) / 5000) * 5000 * 100,
      propertyType: types[i % types.length],
      distance: Math.round(dist * 10) / 10,
      soldOn: `2026-${i < 14 ? '10' : '09'}-${String(1 + Math.floor(rand() * 27)).padStart(2, '0')}`,
      month: i < 14 ? '2026-11' : '2026-10',
      selected: i === 1 || i === 4,
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
            prefs={{ radius: 5, min: 40000000, max: 250000000, types: ['D', 'S', 'T', 'F'] }}
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
