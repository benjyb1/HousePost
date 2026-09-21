import { CARD_W, CARD_H, HALF_W } from '../svg-templates/helpers'

export type CardSide = 'front' | 'back'

/** A user image laid over one side of the card. Units are card px (1819×1311). Height follows the aspect ratio. */
export interface LogoOverlay {
  side: CardSide
  /** Data URL (png/jpeg/svg). Never a remote URL — remote images would taint the export canvas. */
  src: string
  naturalW: number
  naturalH: number
  x: number
  y: number
  w: number
}

export const SAFE = 71
export const MIN_W = 80
/** Right-most usable x on the back: the fold is at HALF_W, keep a gutter before it. */
export const BACK_SAFE_RIGHT = HALF_W - 70 // 840

export function overlayHeight(o: Pick<LogoOverlay, 'w' | 'naturalW' | 'naturalH'>): number {
  return (o.w * o.naturalH) / o.naturalW
}

function bounds(side: CardSide) {
  return { left: SAFE, top: SAFE, right: side === 'back' ? BACK_SAFE_RIGHT : CARD_W - SAFE, bottom: CARD_H - SAFE }
}

/** Keep the box fully inside the safe area for its side; keep width sane. */
export function clampOverlay(o: LogoOverlay): LogoOverlay {
  const b = bounds(o.side)
  const maxW = b.right - b.left
  const w = Math.min(Math.max(o.w, MIN_W), maxW)
  const h = overlayHeight({ ...o, w })
  const x = Math.min(Math.max(o.x, b.left), b.right - w)
  const y = Math.min(Math.max(o.y, b.top), Math.max(b.top, b.bottom - h))
  return { ...o, x, y, w }
}

/** Where a freshly added logo lands: top-right of the usable area, 360px wide. */
export function defaultPlacement(side: CardSide, src: string, naturalW: number, naturalH: number): LogoOverlay {
  const b = bounds(side)
  return clampOverlay({ side, src, naturalW, naturalH, w: 360, x: b.right - 360, y: b.top })
}
