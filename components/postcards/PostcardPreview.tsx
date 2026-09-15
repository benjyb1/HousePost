'use client'

import { Plus } from 'lucide-react'

/**
 * A realistic preview of the finished postcard — FRONT and BACK — so the user
 * can check their design fits before/after making it the active card.
 *
 * Print spec (A6 landscape): artwork is 154×111mm (148×105mm trim + 3mm bleed on
 * every edge), 1819×1311px @ 300 DPI. The preview draws each side at the trimmed
 * A6 ratio with a subtle safe-area guide so fit/bleed is easy to judge.
 *
 * FRONT = the front image fitted edge-to-edge.
 * BACK  = a mock of the posted card: the customer's design occupies the LEFT
 *         half; the RIGHT half is reserved for the address the fulfilment
 *         provider prints (stamp + address lines). Uploaded back images are
 *         already a full card with the design on the left and the right half
 *         left white, so the address mock sits over that reserved area. When no
 *         back exists we show the reserved-address template and prompt to add one.
 */

const TRIM_W = 148
const TRIM_H = 105
const SAFE_MM = 3
// Safe-area inset as a percentage of the trimmed card.
const SAFE_L = (SAFE_MM / TRIM_W) * 100
const SAFE_T = (SAFE_MM / TRIM_H) * 100

function isPdfUrl(url: string) {
  return /\.pdf(\?|$)/i.test(url)
}

/** Dashed safe-area rectangle, inset from the trim on every edge. */
function SafeGuide() {
  return (
    <div
      className="pointer-events-none absolute rounded-[1px] border border-dashed border-blue-400/70"
      style={{ left: `${SAFE_L}%`, right: `${SAFE_L}%`, top: `${SAFE_T}%`, bottom: `${SAFE_T}%` }}
      aria-hidden
    />
  )
}

/** The card frame: correct A6 trim ratio, subtle trim border + safe guide. */
function CardFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative w-full overflow-hidden rounded-md border border-slate-300 bg-white shadow-sm"
      style={{ aspectRatio: `${TRIM_W}/${TRIM_H}` }}
    >
      {children}
      <SafeGuide />
    </div>
  )
}

function ImageFill({ url, alt }: { url: string; alt: string }) {
  if (isPdfUrl(url)) {
    return <iframe src={`${url}#toolbar=0&view=Fit`} className="absolute inset-0 h-full w-full" title={alt} />
  }
  return <img src={url} alt={alt} className="absolute inset-0 h-full w-full object-cover" />
}

/** The reserved right-half address block that the provider prints. */
function AddressArea() {
  return (
    <div className="pointer-events-none absolute inset-y-0 right-0 left-1/2 flex flex-col justify-between border-l border-dashed border-amber-400 bg-amber-50/55 p-[6%]">
      <div className="flex justify-end">
        <div className="flex h-[22%] w-[18%] min-h-6 min-w-8 items-center justify-center rounded-sm border-2 border-dashed border-slate-300 text-[7px] font-medium uppercase text-slate-400">
          Stamp
        </div>
      </div>
      <div className="space-y-[3px]">
        <div className="h-1.5 w-[70%] rounded-full bg-slate-300/80" />
        <div className="h-1.5 w-[85%] rounded-full bg-slate-300/70" />
        <div className="h-1.5 w-[60%] rounded-full bg-slate-300/70" />
        <div className="h-1.5 w-[45%] rounded-full bg-slate-300/60" />
      </div>
      <p className="text-[8px] font-semibold uppercase leading-tight tracking-wide text-amber-600">
        Address printed here
      </p>
    </div>
  )
}

export type PostcardPreviewProps = {
  frontUrl: string | null
  backUrl: string | null
  /** Optional: called from the "add a back design" prompt when the back is missing. */
  onAddBack?: () => void
  className?: string
}

export function PostcardPreview({ frontUrl, backUrl, onAddBack, className }: PostcardPreviewProps) {
  return (
    <div className={`grid gap-5 sm:grid-cols-2 ${className ?? ''}`}>
      {/* FRONT */}
      <figure className="space-y-2">
        <CardFrame>
          {frontUrl ? (
            <ImageFill url={frontUrl} alt="Postcard front" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-50 text-xs text-slate-400">
              No front design yet
            </div>
          )}
        </CardFrame>
        <figcaption className="text-center text-xs font-medium text-slate-500">Front</figcaption>
      </figure>

      {/* BACK */}
      <figure className="space-y-2">
        <CardFrame>
          {backUrl ? (
            <ImageFill url={backUrl} alt="Postcard back design" />
          ) : (
            /* No back design — show the reserved-address template on a plain left half. */
            <div className="absolute inset-y-0 left-0 right-1/2 flex flex-col items-center justify-center gap-2 bg-slate-50 px-3 text-center">
              <p className="text-[11px] font-medium text-slate-500">No back design yet</p>
              {onAddBack && (
                <button
                  type="button"
                  onClick={onAddBack}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-[10px] font-medium text-slate-700 transition hover:border-slate-400"
                >
                  <Plus className="h-3 w-3" />
                  Add a back
                </button>
              )}
            </div>
          )}
          <AddressArea />
        </CardFrame>
        <figcaption className="text-center text-xs font-medium text-slate-500">Back</figcaption>
      </figure>
    </div>
  )
}
