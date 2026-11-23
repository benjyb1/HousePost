import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { Logo } from '@/components/brand/Logo'
import { LandRegistryAttribution } from '@/components/layout/LandRegistryAttribution'
import { TradeRoller } from '@/components/marketing/home/TradeRoller'
import { MonthMap } from '@/components/marketing/home/MonthMap'
import { DemoLoop } from '@/components/marketing/home/DemoLoop'
import { TryIt } from '@/components/marketing/home/TryIt'
import styles from '@/components/marketing/home/home.module.css'

// Trade terms live in the title/description so queries like
// "leads for builders" / "leads for plumbers" have something to match.
export const metadata: Metadata = {
  title: 'Tactical marketing for builders, plumbers, electricians & more | Housepost',
  description:
    'Target newly moved-in homeowners near you. Housepost finds the homes that have just sold near your office and posts your postcard to the ones you pick. £15 a month.',
}

function Tick() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

// Freddie's six sections, in his order (22 Nov 2026), in Paper's design language.
export default function HomePage() {
  return (
    <div className={styles.page}>
      <nav className={styles.nav} aria-label="Main">
        <Link href="/" aria-label="Housepost home"><Logo /></Link>
        <div className={styles.navLinks}>
          <a className={styles.wide} href="#how">How it works</a>
          <a className={styles.wide} href="#pricing">Pricing</a>
          <Link href="/login">Log in</Link>
          <Link className={`${styles.btn} ${styles.btnSm}`} href="/signup">Sign up</Link>
        </div>
      </nav>

      <main>
        {/* 1. hero */}
        <section className={styles.hero} aria-labelledby="strap">
          <Image
            className={styles.heroPhoto}
            src="/home/aerial-terraces.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
          />
          <div className={styles.heroScrim} />
          <div className={`${styles.heroBody} ${styles.onDark}`}>
            <TradeRoller />
            <p className={styles.clear}>
              Target newly <span className={styles.nw}>moved-in</span> homeowners near&nbsp;you.
            </p>
            <div className={styles.ctaRow}>
              <Link className={styles.btn} href="/signup">Start for £15 a month</Link>
            </div>
          </div>
        </section>

        {/* 2. the animation */}
        <section className={styles.reel} aria-labelledby="reel-h">
          <div>
            <h2 className={styles.secH} id="reel-h">Fresh leads every month</h2>
            <p className={styles.secP}>New sales near you appear on your map. Pick the ones worth a card and we post it through their door.</p>
          </div>
          <MonthMap />
        </section>

        {/* 3. pricing */}
        <section className={styles.pricing} id="pricing" aria-labelledby="price-h">
          <div className={styles.pricingPhoto}>
            <Image src="/home/letterbox.jpg" alt="Post pushed through the letterbox of a painted front door" fill sizes="(max-width: 899px) 100vw, 42vw" />
          </div>
          <div className={`${styles.pricingBody} ${styles.onDark}`}>
            <h2 className={styles.price} id="price-h">£15 a month</h2>
            <p>Five postcards included every month, printed and posted. Extra cards are £1.50 each.</p>
            <ul className={styles.ticks}>
              <li><Tick />Fresh leads monthly</li>
              <li><Tick />Cancel anytime</li>
            </ul>
            <div className={styles.ctaRow}>
              <Link className={styles.btn} href="/signup">Start for £15 a month</Link>
            </div>
          </div>
        </section>

        {/* 4. how it works */}
        <section className={styles.how} id="how" aria-labelledby="how-h">
          <DemoLoop />
          <div>
            <h2 className={styles.secH} id="how-h">How it works</h2>
            <ol className={styles.howSteps}>
              <li><span className={styles.n}>1</span><div><b>Set your patch</b><span className={styles.d}>Your office postcode, how far to look and the kind of homes you want.</span></div></li>
              <li><span className={styles.n}>2</span><div><b>Pick your homes</b><span className={styles.d}>Fresh leads arrive every month. Tick the ones you want and press send.</span></div></li>
              <li><span className={styles.n}>3</span><div><b>We post your card</b><span className={styles.d}>Use one of our designs or upload your own. We print it, post it and show you when it lands.</span></div></li>
            </ol>
          </div>
        </section>

        {/* 5. try it yourself */}
        <section className={styles.try} id="try" aria-labelledby="try-h">
          <div className={styles.tryIn}>
            <h2 className={styles.secH} id="try-h">Try it yourself</h2>
            <p className={styles.secP}>Put in your office postcode to see how many homes have sold near you.</p>
            <TryIt />
            <p className={styles.trySrc}>
              Counts are sales within 5 miles in the latest month of data. The estimate uses research by Zoopla with Opinium,
              published in February 2025: 44% of buyers renovated within their first year of moving in.
            </p>
          </div>
        </section>

        {/* 6. sign up */}
        <section className={styles.cta} aria-labelledby="cta-h">
          <h2 id="cta-h">Be the first name through their door.</h2>
          <div className={styles.ctaSide}>
            <Link className={styles.btn} href="/signup">Sign up today</Link>
            <span>£15 a month. Cancel anytime.</span>
          </div>
        </section>
      </main>

      <footer className={styles.foot}>
        <span>© 2026 Housepost</span>
        <nav aria-label="Footer">
          <Link href="/help">Help</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/opt-out">Opt out of mail</Link>
          <Link href="/login">Log in</Link>
        </nav>
        <div className={styles.lic}>
          <LandRegistryAttribution className="" />
          <p>Photos from Unsplash.</p>
        </div>
      </footer>
    </div>
  )
}
