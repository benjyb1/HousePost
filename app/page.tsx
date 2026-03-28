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
  Search,
} from 'lucide-react'

// Fully static marketing page — no Supabase calls needed
// Logged-in users navigating to /dashboard are handled by middleware
export default function HomePage() {

  return (
    <div className="min-h-screen bg-white">
      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/">
            <Image
              src="/logo-wordmark.png"
              alt="Housepost"
              width={600}
              height={150}
              className="h-10 w-auto"
              priority
            />
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative bg-brand overflow-hidden">
        {/* SVG dot pattern overlay */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ opacity: 0.06 }}
        >
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern
                id="hero-dots"
                x="0"
                y="0"
                width="24"
                height="24"
                patternUnits="userSpaceOnUse"
              >
                <circle cx="2" cy="2" r="1.2" fill="white" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#hero-dots)" />
          </svg>
        </div>

        <div className="relative mx-auto max-w-6xl px-6 pt-20 pb-24 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm text-white mb-6">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white"></span>
            </span>
            Monthly leads, automated
          </div>
          <h1 className="mx-auto max-w-3xl text-5xl font-extrabold leading-tight tracking-tight text-white">
            Turning local property sales data into{' '}
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: 'linear-gradient(135deg, #C0C0C0, #E8E8E8, #A0A0A0)',
                textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.25))',
              }}
            >
              postcard campaigns
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-xl text-white/80 leading-relaxed">
            Every month, Housepost scans the recently sold homes in your local area
            and delivers your postcard through their letterbox - without you lifting a finger.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 text-base font-semibold text-brand shadow-lg hover:bg-white/90 transition-all"
            >
              Start free — £15/month
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
      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-3xl font-bold text-slate-900 mb-4">
            Three steps. Fully automatic.
          </h2>
          <p className="text-center text-slate-500 mb-14 max-w-xl mx-auto">
            We do the heavy lifting — you just choose which properties to
            target.
          </p>
          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                icon: TrendingUp,
                step: '01',
                title: 'We find the sales',
                body: 'Every month we scan recent house sales in your area to assemble a list of all the newly-owned homes near you.',
              },
              {
                icon: MapPin,
                step: '02',
                title: 'You pick your targets',
                body: 'Log in, review the list, select the ones you want to contact. Filter by distance, price, or property type.',
              },
              {
                icon: Mail,
                step: '03',
                title: 'We send the postcards',
                body: 'We print and deliver your postcard via Royal Mail. Track each one in real time.',
              },
            ].map(({ icon: Icon, step, title, body }) => (
              <div key={step} className="rounded-2xl bg-white p-8 shadow-sm border border-slate-100">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xs font-bold text-brand tracking-widest">{step}</span>
                  <div className="h-10 w-10 rounded-xl bg-brand-light flex items-center justify-center">
                    <Icon className="h-5 w-5 text-brand" />
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{body}</p>
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
              { icon: Search, title: 'Always enough leads', body: "Can't find 15 properties nearby? We widen the search automatically, up to a 50 mile radius." },
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
      <section className="bg-slate-50 py-20">
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
                '5 postcards included',
                'Each additional postcard just £1',
                'Email alerts when your leads are ready',
                'Automatic radius expansion',
                'Live tracking',
                'No setup fee',
                'Cancel anytime',
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 text-sm text-slate-700">
                  <CheckCircle className="h-4 w-4 text-brand shrink-0 mt-0.5" />
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
      <section className="py-20 text-center">
        <div className="mx-auto max-w-2xl px-6">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">
            Ready to reach new homeowners in your area?
          </h2>
          <p className="text-slate-500 mb-8">
            Local leads, automated. Direct marketing couldn&apos;t be easier with Housepost.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-8 py-3.5 text-base font-semibold text-white shadow-lg hover:bg-brand-dark transition-all"
          >
            Start for £15/month
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t py-12">
        <div className="mx-auto max-w-6xl px-6 flex flex-col gap-8 sm:flex-row sm:justify-between">
          {/* Left side */}
          <div className="flex flex-col gap-3">
            <Image
              src="/logo-wordmark.png"
              alt="Housepost"
              width={600}
              height={150}
              className="h-10 w-auto"
            />
            <p className="text-xs text-slate-400">Copyright &copy; 2026 | Housepost</p>
            <div className="flex flex-col gap-1 text-sm text-slate-500">
              <Link href="/login" className="hover:text-slate-700 transition-colors">Login</Link>
              <Link href="/signup" className="hover:text-slate-700 transition-colors">Sign up</Link>
            </div>
          </div>

          {/* Right side */}
          <div className="flex flex-col gap-3 sm:items-end sm:text-right">
            <p className="text-sm text-slate-400">
              Data sourced from HM Land Registry &middot; Printed by PostGrid
            </p>
            <div className="flex flex-col gap-1 text-sm text-slate-500 sm:items-end">
              <Link href="/privacy" className="hover:text-slate-700 transition-colors">Privacy policy</Link>
              <Link href="/terms" className="hover:text-slate-700 transition-colors">Terms and conditions</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
