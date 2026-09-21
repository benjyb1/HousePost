import { CARD_H, HALF_W, escapeXml } from '../svg-templates/helpers'
import { overlayHeight, type LogoOverlay } from './types'

/**
 * Append the logo to a rendered card SVG so the export picks it up. On the back
 * it is wrapped in the same left-half clip the templates use, so it can never
 * print over the address area.
 */
export function injectOverlay(svg: string, o: LogoOverlay | null): string {
  if (!o) return svg
  const end = svg.lastIndexOf('</svg>')
  if (end === -1) return svg
  const h = Math.round(overlayHeight(o))
  const image = `<image x="${Math.round(o.x)}" y="${Math.round(o.y)}" width="${Math.round(o.w)}" height="${h}" preserveAspectRatio="xMidYMid meet" href="${escapeXml(o.src)}"/>`
  const markup =
    o.side === 'back'
      ? `<svg x="0" y="0" width="${HALF_W}" height="${CARD_H}" viewBox="0 0 ${HALF_W} ${CARD_H}" overflow="hidden">${image}</svg>`
      : image
  return svg.slice(0, end) + markup + svg.slice(end)
}
