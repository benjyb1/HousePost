import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { SiteFooter } from '@/components/layout/SiteFooter'

export const metadata: Metadata = {
  title: 'Postcard print specifications | Housepost',
  description:
    'How to prepare your Housepost postcard design: A6 size, bleed, safe area, the reserved address area, file format and resolution.',
}

const SPECS: [string, string][] = [
  ['Card size', 'A6 landscape, 148 × 105 mm once trimmed.'],
  ['Artwork size', '154 × 111 mm. That is the card plus 3 mm of bleed on every edge.'],
  ['Bleed', 'Extend backgrounds and images to the full 154 × 111 mm. We trim 3 mm off every edge.'],
  ['Safe area', 'Keep text, logos and anything important at least 3 mm inside the trimmed edge, so nothing is cut off.'],
  ['File type', 'PDF. We use the first page only.'],
  ['Resolution', '300 DPI or higher. Below that the printed card can look soft.'],
]

export default function PrintSpecsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
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
        </div>
      </nav>

      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-5 py-12 sm:px-6 sm:py-16">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Postcard print specifications
          </h1>
          <p className="mt-3 text-slate-600">
            Follow these when you upload a design and it will print the way it
            looks in the preview.
          </p>

          <dl className="mt-8 divide-y divide-slate-200 rounded-xl border border-slate-200">
            {SPECS.map(([term, detail]) => (
              <div key={term} className="grid gap-1 p-4 sm:grid-cols-[10rem_1fr] sm:gap-4">
                <dt className="font-semibold text-slate-900">{term}</dt>
                <dd className="text-slate-700">{detail}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-8 space-y-8 text-[15px] leading-relaxed text-slate-700">
            <section>
              <h2 className="text-lg font-semibold text-slate-900">Front</h2>
              <p className="mt-2">
                The front is yours to design. Fill the whole 154 × 111 mm page,
                bleed included.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">Back</h2>
              <p className="mt-2">
                The back is the same size, but only the left half is yours. The
                right half is reserved for the stamp area, the recipient’s address
                and our privacy and opt-out wording. Keep it clear and leave it
                white. Anything you put there is covered when the card is printed.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">Check the preview</h2>
              <p className="mt-2">
                The preview shows the trimmed edge, the safe area and the reserved
                address area. Check it before you confirm an order, because we
                print what you approve. Small differences in colour between screen
                and print are normal. See our{' '}
                <Link className="font-medium text-brand underline" href="/terms">
                  terms of service
                </Link>{' '}
                for the full details.
              </p>
            </section>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
