import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { Search, MapPin, TrendingUp, Home, ArrowRight, AlertCircle } from 'lucide-react'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { formatPricePence, formatMonthKey } from '@/lib/utils/date'
import {
  lookupHousesSold,
  clampRadius,
  DEFAULT_RADIUS_MILES,
  MIN_RADIUS_MILES,
  MAX_RADIUS_MILES,
} from '@/app/api/houses-sold/route'

export const metadata: Metadata = {
  title: 'Houses Sold Near You — Recent UK Sales by Postcode | Housepost',
  description:
    'See how many homes recently sold near any UK postcode and the average price paid, straight from the official Land Registry data. Enter a postcode and radius to find out.',
}

// Reads live data via the service-role client — always render on request.
export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ postcode?: string; radius?: string }>
}

export default async function HousesSoldPage({ searchParams }: PageProps) {
  const params = await searchParams
  const rawPostcode = (params.postcode ?? '').trim()
  const radius = clampRadius(params.radius)
  const hasQuery = rawPostcode.length > 0

  const result = hasQuery ? await lookupHousesSold(rawPostcode, radius) : null

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* ── Nav ── */}
      <nav className="border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4 sm:px-6">
          <Link href="/" className="shrink-0">
            <Image
              src="/logo-wordmark.png"
              alt="Housepost"
              width={600}
              height={150}
              className="h-8 w-auto sm:h-9"
              priority
            />
          </Link>
          <Link
            href="/signup"
            className="whitespace-nowrap rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
          >
            Get started
          </Link>
        </div>
      </nav>

      <main className="flex-1">
        {/* ── Hero + lookup form ── */}
        <section className="bg-brand">
          <div className="mx-auto max-w-3xl px-5 pt-14 pb-16 sm:px-6 sm:pt-20">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm text-white">
              <MapPin className="h-3.5 w-3.5" />
              Official UK Land Registry data
            </div>
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl">
              How many homes recently sold near you?
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/80 sm:text-lg">
              Enter a postcode and a radius to see how many properties changed hands
              in the latest month of data, and the average price paid.
            </p>

            {/* Native GET form — results are shareable via the URL and work without JS. */}
            <form
              method="get"
              className="mt-8 rounded-2xl bg-white p-4 shadow-lg sm:p-5"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <label
                    htmlFor="postcode"
                    className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    Postcode
                  </label>
                  <input
                    id="postcode"
                    name="postcode"
                    type="text"
                    inputMode="text"
                    autoComplete="postal-code"
                    required
                    defaultValue={rawPostcode}
                    placeholder="e.g. SW1A 1AA"
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-base uppercase text-slate-900 placeholder:normal-case placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                  />
                </div>
                <div className="sm:w-36">
                  <label
                    htmlFor="radius"
                    className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    Radius (miles)
                  </label>
                  <input
                    id="radius"
                    name="radius"
                    type="number"
                    min={MIN_RADIUS_MILES}
                    max={MAX_RADIUS_MILES}
                    step={1}
                    defaultValue={radius}
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-base text-slate-900 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-base font-semibold text-white transition-colors hover:bg-brand-dark sm:w-auto"
                >
                  <Search className="h-4 w-4" />
                  Search
                </button>
              </div>
            </form>
          </div>
        </section>

        {/* ── Result ── */}
        {result && (
          <section className="bg-slate-50 py-10 sm:py-14">
            <div className="mx-auto max-w-3xl px-5 sm:px-6">
              {result.ok ? (
                <ResultCard result={result} />
              ) : (
                <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-semibold">We couldn&apos;t run that search</p>
                    <p className="mt-1 text-sm">{result.error}</p>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Marketing copy + CTA (spec 14.3) ── */}
        <section className={result ? 'py-14 sm:py-16' : 'bg-slate-50 py-14 sm:py-16'}>
          <div className="mx-auto max-w-2xl px-5 text-center sm:px-6">
            <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-light">
              <TrendingUp className="h-6 w-6 text-brand" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
              Do you run a business in the local area?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-slate-600">
              The first few months after moving house are prime time for home
              renovations. Access these leads today with Housepost.
            </p>
            <Link
              href="/"
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-brand px-8 py-3.5 text-base font-semibold text-white shadow-lg transition-all hover:bg-brand-dark"
            >
              See how it works
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}

/** Prominent, screenshot-friendly headline figures (spec 14.2). */
function ResultCard({
  result,
}: {
  result: Extract<Awaited<ReturnType<typeof lookupHousesSold>>, { ok: true }>
}) {
  const { count, averagePricePence, postcode, radiusMiles, month } = result
  const miles = `${radiusMiles} ${radiusMiles === 1 ? 'mile' : 'miles'}`

  if (count === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
          <Home className="h-6 w-6 text-slate-400" />
        </div>
        <p className="text-lg font-semibold text-slate-900">
          No recorded sales within {miles} of{' '}
          <span className="text-brand">{postcode}</span> last month
        </p>
        <p className="mt-2 text-sm text-slate-500">
          Try widening the radius, or check back after the next monthly update.
          Based on {formatMonthKey(month)} data.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-6 py-6 text-center sm:px-8 sm:py-8">
        <p className="text-base leading-relaxed text-slate-600 sm:text-lg">
          <span className="text-3xl font-extrabold text-brand sm:text-4xl">
            {count.toLocaleString('en-GB')}
          </span>{' '}
          {count === 1 ? 'property' : 'properties'} recently sold within{' '}
          <span className="font-semibold text-slate-900">{miles}</span> of{' '}
          <span className="font-semibold text-slate-900">{postcode}</span>
        </p>
      </div>
      <div className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        <div className="px-6 py-6 text-center sm:px-8">
          <div className="mb-1 flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <Home className="h-3.5 w-3.5" />
            Homes sold
          </div>
          <p className="text-3xl font-extrabold text-slate-900">
            {count.toLocaleString('en-GB')}
          </p>
        </div>
        <div className="px-6 py-6 text-center sm:px-8">
          <div className="mb-1 flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <TrendingUp className="h-3.5 w-3.5" />
            Average price paid
          </div>
          <p className="text-3xl font-extrabold text-slate-900">
            {averagePricePence != null ? formatPricePence(averagePricePence) : '—'}
          </p>
        </div>
      </div>
      <p className="bg-slate-50 px-6 py-3 text-center text-xs text-slate-400">
        Based on {formatMonthKey(month)} data from the HM Land Registry Price Paid dataset
        {result.capped ? ' (showing a sample of a very large area)' : ''}.
      </p>
    </div>
  )
}
