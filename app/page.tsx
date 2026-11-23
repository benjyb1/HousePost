import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { Hanken_Grotesk } from 'next/font/google'
import { LandRegistryAttribution } from '@/components/layout/LandRegistryAttribution'
import { Logo, HOUSE_WINDOW } from '@/components/marketing/home/Logo'
import { RollerHeadline } from '@/components/marketing/home/RollerHeadline'
import { NewSalesSection } from '@/components/marketing/home/NewSalesSection'
import { HowItWorks } from '@/components/marketing/home/HowItWorks'
import { SalesCheck } from '@/components/marketing/home/SalesCheck'
import styles from '@/components/marketing/home/home.module.css'

// Paper's typeface, the one Freddie liked for being quick to read
const text = Hanken_Grotesk({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-text' })

// Trade terms live in the title/description so queries like
// "leads for builders" / "leads for plumbers" have something to match.
export const metadata: Metadata = {
  title: 'Local leads for builders, plumbers, electricians & more | Housepost',
  description:
    'Housepost posts your postcard to the people who have just bought a home near you. Local leads for builders, plumbers, electricians, kitchen fitters, architects and interior designers.',
}

// Static marketing page. The order is Freddie's: hero, the map animation,
// price, how it works, try it yourself, sign up.
export default function HomePage() {
  return (
    <div className={`${text.variable} ${styles.page}`}>
      {/* ── 1. Hero ── */}
      <header className={styles.hero}>
        <div className={styles.wrap}>
          <nav className={styles.nav} aria-label="Main">
            <Link href="/" className={styles.logoLink} aria-label="Housepost home">
              <Logo priority />
            </Link>
            <div className={styles.navLinks}>
              <a href="#how" className={styles.navOptional}>
                How it works
              </a>
              <a href="#pricing" className={styles.navOptional}>
                Pricing
              </a>
              <Link href="/login">Log in</Link>
              <Link href="/signup" className={`${styles.button} ${styles.buttonInk}`}>
                Sign up
              </Link>
            </div>
          </nav>
        </div>

        <div className={`${styles.wrap} ${styles.heroBody}`}>
          <div className={styles.heroText}>
            <RollerHeadline />
            <p className={styles.heroLine}>
              Each month we post your card to the people who have just bought a home near you.
              Nearly half of them renovate in their first year.
            </p>
            <div className={styles.heroActions}>
              <Link href="/signup" className={`${styles.button} ${styles.buttonAccent}`}>
                Start for £15 a month
              </Link>
              <a href="#how" className={styles.textLink}>
                How it works
              </a>
            </div>
          </div>
        </div>

        {/* The house from the logo, as a window onto rows of terraced houses */}
        <div className={styles.heroShape} aria-hidden="true">
          <div className={styles.shutter}>
            <Image
              src="/home/aerial-terraces.jpg"
              alt=""
              fill
              priority
              sizes="(max-width: 900px) 130vw, 76vw"
              style={{ objectFit: 'cover', objectPosition: 'center 65%' }}
            />
          </div>
          <svg className={styles.heroWindow} viewBox="0 0 3000 3000" aria-hidden="true">
            <path d={HOUSE_WINDOW} fill="#ff7614" fillRule="evenodd" />
          </svg>
        </div>
      </header>

      <main>
        {/* ── 2. The premise: new sales near you, every month ── */}
        <NewSalesSection />

        {/* ── 3. Price ── */}
        <section id="pricing" className={`${styles.wrap} ${styles.price}`} aria-labelledby="price-title">
          <div className={`${styles.priceIntro} ${styles.reveal}`}>
            <h2 id="price-title" className={styles.head}>
              What it costs
            </h2>
            <p>One subscription with five postcards included every month, and no setup fee.</p>
          </div>
          <div className={`${styles.figureBlock} ${styles.reveal2}`}>
            <div className={styles.figureWrap}>
              <p className={styles.figure}>
                <span className={styles.figureSign}>£</span>15
                <span className={styles.figurePer}>a month</span>
              </p>
              <div className={styles.figureHouse} aria-hidden="true">
                <Image src="/home/aerial-leafy.jpg" alt="" fill sizes="160px" />
              </div>
            </div>
            <ul className={styles.included}>
              <li>Five postcards every month, printed and posted</li>
              <li>Extra postcards £1.50 each</li>
              <li>Fresh leads every month</li>
              <li>Cancel anytime</li>
            </ul>
            <Link href="/signup" className={`${styles.button} ${styles.buttonAccent}`}>
              Start today
            </Link>
          </div>
        </section>

        {/* ── 4. How it works ── */}
        <HowItWorks />

        {/* ── 5. Try it yourself ── */}
        <SalesCheck />

        {/* ── 6. Sign up ── */}
        <section className={`${styles.wrap} ${styles.cta}`} aria-labelledby="cta-title">
          <h2 id="cta-title" className={`${styles.head} ${styles.reveal}`}>
            Be the first name through the door.
          </h2>
          <div className={styles.ctaSide}>
            <p>£15 a month with five postcards included. Cancel anytime.</p>
            <Link href="/signup" className={`${styles.button} ${styles.buttonAccent}`}>
              Sign up today
            </Link>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.wrap}>
          <Logo tone="white" className={styles.footerMark} wordWidth={1080} />
          <div className={styles.footerCols}>
            <ul>
              <li>
                <a href="#how">How it works</a>
              </li>
              <li>
                <a href="#pricing">Pricing</a>
              </li>
              <li>
                <a href="#check">Try it yourself</a>
              </li>
            </ul>
            <ul>
              <li>
                <Link href="/login">Log in</Link>
              </li>
              <li>
                <Link href="/signup">Sign up</Link>
              </li>
              <li>
                <Link href="/help">Help</Link>
              </li>
            </ul>
            <ul>
              <li>
                <Link href="/opt-out">Opt out of mail</Link>
              </li>
              <li>
                <Link href="/privacy">Privacy policy</Link>
              </li>
            </ul>
            <div>
              <LandRegistryAttribution className={styles.footerSmall} />
            </div>
          </div>
          <p className={styles.footerLast}>© 2026 Housepost. Aerial photographs by Ben Elliott on Unsplash.</p>
        </div>
      </footer>
    </div>
  )
}
