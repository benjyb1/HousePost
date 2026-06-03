import Link from 'next/link'
import Image from 'next/image'
import {
  MapPin,
  Mail,
  TrendingUp,
  Shield,
  Clock,
  CheckCircle,
  ArrowRight,
} from 'lucide-react'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { HeroBackground } from '@/components/marketing/HeroBackground'

// Fully static marketing page — no Supabase calls needed
// Logged-in users navigating to /dashboard are handled by middleware
export default function HomePage() {

  return (
    <div className="min-h-screen bg-white">
      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="shrink-0">
            <Image
              src="/logo-wordmark.png"
              alt="Housepost"
              width={600}
              height={150}
              className="h-8 w-auto sm:h-10"
              priority
            />
          </Link>
          <div className="flex items-center gap-3 sm:gap-6">
            <Link
              href="#how-it-works"
              className="hidden sm:inline text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              How it works
            </Link>
            <Link
              href="#pricing"
              className="hidden sm:inline text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Pricing
            </Link>
            {/* Divider separating the section links from the account actions */}
            <span
              aria-hidden="true"
              className="hidden sm:inline-block h-4 w-px bg-slate-300"
            />
            <Link
              href="/login"
              className="whitespace-nowrap text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="whitespace-nowrap rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-brand">
        {/* Aerial-houses background with a heavy navy duotone over the top */}
        <HeroBackground />
        {/* Navy duotone: heavier on the left for text legibility, lighter on the
            right so the aerial houses stay visible. On mobile the left-to-right
            contrast is gentler — a steep gradient over a narrow screen looks
            harsh, so we keep it subtle there and only ramp it up from sm up. */}
        <div className="absolute inset-0 bg-gradient-to-r from-brand/90 to-brand/65 sm:from-brand/95 sm:via-brand/75 sm:to-brand/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-brand/60 to-transparent" />
        {/* Subtle dot texture */}
        <div className="pointer-events-none absolute inset-0" style={{ opacity: 0.06 }}>
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="hero-dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1.2" fill="white" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#hero-dots)" />
          </svg>
        </div>

        <div className="relative mx-auto max-w-6xl px-6 pt-20 pb-24 text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm text-white mb-6">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-signal"></span>
            </span>
            Monthly leads, automated
          </div>
          <h1 className="max-w-3xl text-5xl font-extrabold leading-tight tracking-tight text-white">
            Turn recent house sales data into{' '}
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: 'linear-gradient(135deg, #cfe3fe, #93c5fd, #5b9bf5)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.25))',
              }}
            >
              leads worth your time
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-xl text-white/80 leading-relaxed">
            Every month, Housepost scans the recently sold homes in your local area
            and delivers your postcard through their letterbox. You pick the targets,
            we handle the rest.
          </p>
          <div className="mt-10 flex flex-col items-start gap-4 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 text-base font-semibold text-brand shadow-lg hover:bg-white/90 transition-all"
            >
              Start for £15/month
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl border border-white/30 px-8 py-3.5 text-base font-semibold text-white hover:bg-white/10 transition-colors"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" className="scroll-mt-20 bg-slate-50 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-3xl font-bold text-slate-900 mb-4">
            Three steps. Fully automatic.
          </h2>
          <p className="text-center text-slate-500 mb-14 max-w-xl mx-auto">
            We do the heavy lifting – you just choose which properties to target.
          </p>
          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                icon: TrendingUp,
                step: '01',
                title: (
                  <>
                    We scan for recent <span className="font-bold text-slate-700">sales</span>
                  </>
                ),
                body: 'Every month we scan recent house sales in your local area and assemble a list of all the newly-owned homes near you.',
              },
              {
                icon: MapPin,
                step: '02',
                title: (
                  <>
                    You pick your <span className="font-bold text-slate-700">targets</span>
                  </>
                ),
                body: 'Log in, review the list, select the ones you want to contact. Filter by distance, price, or property type.',
              },
              {
                icon: Mail,
                step: '03',
                title: (
                  <>
                    We send the <span className="font-bold text-slate-700">postcards</span>
                  </>
                ),
                body: 'We handle the printing and postage of every postcard. Track each one in real time.',
              },
            ].map(({ icon: Icon, step, title, body }, index) => (
              <div
                key={step}
                className="relative rounded-2xl bg-white p-8 shadow-sm border border-slate-100"
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xs font-bold text-brand tracking-widest">{step}</span>
                  <div className="h-10 w-10 rounded-xl bg-brand-light flex items-center justify-center">
                    <Icon className="h-5 w-5 text-brand" />
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{body}</p>

                {/* Arrow to the next step (desktop only), with a subtle pulse */}
                {index < 2 && (
                  <ArrowRight
                    aria-hidden="true"
                    className="hidden md:block absolute top-1/2 -right-7 -translate-y-1/2 h-6 w-6 text-brand-accent animate-pulse"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-3xl font-bold text-slate-900 mb-14">
            Everything included
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Clock, title: 'Runs by itself', body: 'Fires automatically every month, you just select and send.' },
              { icon: Shield, title: 'Fresh data, every month', body: 'We use the official UK house sales register, updated monthly.' },
              { icon: CheckCircle, title: 'Filter your way', body: 'Sort leads by distance, price, or property type.' },
              { icon: Mail, title: 'Printed and posted', body: 'Professionally printed by PostGrid and delivered by Royal Mail.' },
              { icon: TrendingUp, title: 'Live tracking', body: 'Keep an eye on every postcard, from printer to postbox.' },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex gap-4 p-6 rounded-xl border border-slate-100 hover:border-brand-border hover:bg-brand-light/30 transition-colors">
                <div className="h-9 w-9 shrink-0 rounded-lg bg-brand-light flex items-center justify-center mt-0.5">
                  <Icon className="h-4 w-4 text-brand" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800 mb-1">{title}</p>
                  <p className="text-sm text-slate-500 leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="scroll-mt-20 bg-slate-50 py-20">
        <div className="mx-auto max-w-md px-6 text-center">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">Simple pricing</h2>
          <p className="text-slate-500 mb-10">One plan. All the features.</p>
          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-brand px-8 py-8 text-white">
              <p className="text-sm font-medium opacity-80 mb-1">Monthly subscription</p>
              <div className="flex items-end justify-center gap-1">
                <span className="text-5xl font-extrabold">£15</span>
                <span className="text-xl opacity-70 mb-1">/month</span>
              </div>
            </div>
            <div className="px-8 py-8 space-y-3">
              {[
                'Includes 5 free postcards per month',
                'Each additional postcard just £1.50',
                'Email alerts when your leads are ready',
                'Live tracking',
                'No setup fee',
                'Cancel anytime',
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 text-sm text-slate-700">
                  <CheckCircle className="h-4 w-4 text-signal shrink-0 mt-0.5" />
                  {item}
                </div>
              ))}
              <div className="pt-4">
                <Link
                  href="/signup"
                  className="block w-full rounded-xl bg-brand py-3 text-center text-sm font-semibold text-white hover:bg-brand-dark transition-colors"
                >
                  Get started
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="bg-brand py-20 text-center">
        <div className="mx-auto max-w-2xl px-6">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to reach{' '}
            <span className="text-brand-accent">new homeowners near you</span>?
          </h2>
          <p className="text-white/70 mb-8">
            Local leads, automated. Direct marketing couldn&apos;t be easier.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 text-base font-semibold text-brand shadow-lg hover:bg-white/90 transition-all"
          >
            Start for £15/month
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <SiteFooter />
    </div>
  )
}
