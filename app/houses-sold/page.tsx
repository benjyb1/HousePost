import type { Metadata } from 'next'
import Link from 'next/link'
import { AlertCircle } from 'lucide-react'
import { PublicNav } from '@/components/layout/PublicNav'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import styles from '@/components/layout/public.module.css'
import { formatPricePence, formatMonthKey } from '@/lib/utils/date'
import {
  lookupHousesSold,
  clampRadius,
  MIN_RADIUS_MILES,
  MAX_RADIUS_MILES,
} from '@/app/api/houses-sold/route'

export const metadata: Metadata = {
  title: 'Houses Sold Near You: Recent UK Sales by Postcode | Housepost',
  description:
    'See how many homes recently sold near any UK postcode and the average price paid, straight from official government data. Enter a postcode and radius to find out.',
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
    <div className={styles.shell}>
      <PublicNav />

      <main className={styles.main}>
        {/* ── Lookup ── */}
        <section className={styles.lookup} aria-labelledby="hs-title">
          <div className={styles.lookupIn}>
            <h1 className={styles.title} id="hs-title">
              How many homes recently sold near you?
            </h1>
            <p className={styles.lede}>
              Enter a postcode and a radius to see how many properties changed hands
              in the latest month of data, and the average price paid.
            </p>

            {/* Native GET form — results are shareable via the URL and work without JS. */}
            <form method="get" className={styles.lookupForm}>
              <div className={styles.pcField}>
                <label htmlFor="postcode" className={styles.label}>
                  Postcode
                </label>
                <Input
                  id="postcode"
                  name="postcode"
                  type="text"
                  inputMode="text"
                  autoComplete="postal-code"
                  required
                  defaultValue={rawPostcode}
                  placeholder="e.g. SW1A 1AA"
                  className="h-[52px] rounded-[3px] text-[17px] uppercase tracking-[0.02em] placeholder:normal-case placeholder:tracking-normal md:text-[17px]"
                />
              </div>
              <div className={styles.radiusField}>
                <label htmlFor="radius" className={styles.label}>
                  Radius (miles)
                </label>
                <Input
                  id="radius"
                  name="radius"
                  type="number"
                  min={MIN_RADIUS_MILES}
                  max={MAX_RADIUS_MILES}
                  step={1}
                  defaultValue={radius}
                  className="h-[52px] rounded-[3px] text-[17px] md:text-[17px]"
                />
              </div>
              <Button type="submit" size="lg" className="h-[52px] px-7 text-[15px]">
                Search
              </Button>
            </form>

            {/* ── Result ── */}
            {result && (
              <div className={styles.answer} aria-live="polite">
                {result.ok ? (
                  <Answer result={result} />
                ) : (
                  <div role="alert">
                    <p className={styles.err}>
                      <AlertCircle aria-hidden="true" />
                      <span>
                        <strong>We couldn&apos;t run that search.</strong> {result.error}
                      </span>
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* ── Marketing copy + CTA (spec 14.3) ── */}
        <section className={styles.cta} aria-labelledby="hs-cta">
          <div>
            <h2 id="hs-cta">Do you run a business in the local area?</h2>
            <p>
              The first few months after moving house are prime time for home
              renovations. Access these leads today with Housepost.
            </p>
          </div>
          <Link href="/#how" className={cn(buttonVariants({ size: 'lg' }), 'h-[52px] px-7 text-[15px]')}>
            See how it works
          </Link>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}

/** The headline figures as one sentence, big enough to screenshot (spec 14.2). */
function Answer({
  result,
}: {
  result: Extract<Awaited<ReturnType<typeof lookupHousesSold>>, { ok: true }>
}) {
  const { count, averagePricePence, postcode, radiusMiles, month } = result
  const miles = `${radiusMiles} ${radiusMiles === 1 ? 'mile' : 'miles'}`

  if (count === 0) {
    return (
      <>
        <p className={styles.answerBig}>
          No recorded sales within {miles} of <b>{postcode}</b> last month.
        </p>
        <p className={styles.source}>
          Try widening the radius, or check back after the next monthly update.
          Based on {formatMonthKey(month)} data.
        </p>
      </>
    )
  }

  return (
    <>
      <p className={styles.answerBig}>
        <b>
          {count.toLocaleString('en-GB')} {count === 1 ? 'property' : 'properties'}
        </b>{' '}
        recently sold within {miles} of <b>{postcode}</b>.
        {averagePricePence != null && (
          <>
            {' '}The average price paid was <b>{formatPricePence(averagePricePence)}</b>.
          </>
        )}
      </p>
      <p className={styles.source}>
        Based on official government data for {formatMonthKey(month)}
        {result.capped ? ' (showing a sample of a very large area)' : ''}.
      </p>
    </>
  )
}
