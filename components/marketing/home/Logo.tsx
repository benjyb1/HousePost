import Image from 'next/image'
import styles from './home.module.css'

/*
  Freddie's Housepost logo. The house is redrawn from logo-icon.png at its own
  proportions (a 3000-unit square, strokes 203 units) so the small inner house
  can carry the orange. The lettering is his original artwork, cropped tight.
*/

export const HOUSE_OUTLINE =
  'M1500 0L3000 1500V1703H2522V3000H1704V2300H1295V3000H475V1703H0V1500Z' +
  'M1500 289L289 1500H678V2796H1092V2097H1907V2796H2320V1500H2711Z'
export const HOUSE_WINDOW =
  'M1500 934L1907 1341V1813H1092V1341Z' + 'M1500 1221L1295 1426V1611H1704V1426Z'

const NAVY = '#132251'
const ORANGE = '#ff7614'

export function HouseMark({
  tone = 'navy',
  className,
}: {
  tone?: 'navy' | 'white'
  className?: string
}) {
  return (
    <svg viewBox="0 0 3000 3000" className={className} aria-hidden="true" focusable="false">
      <path d={HOUSE_OUTLINE} fill={tone === 'white' ? '#ffffff' : NAVY} fillRule="evenodd" />
      <path d={HOUSE_WINDOW} fill={ORANGE} fillRule="evenodd" />
    </svg>
  )
}

export function Logo({
  tone = 'navy',
  className,
  priority = false,
  wordWidth = 420,
}: {
  tone?: 'navy' | 'white'
  className?: string
  priority?: boolean
  /** the lettering's largest displayed width in CSS pixels, so the right image size is fetched */
  wordWidth?: number
}) {
  return (
    <span className={`${styles.logo} ${className ?? ''}`}>
      <HouseMark tone={tone} className={styles.logoMark} />
      <Image
        src={tone === 'white' ? '/brand/wordmark-white.png' : '/brand/wordmark-navy.png'}
        alt="Housepost"
        width={wordWidth}
        height={Math.round((wordWidth * 386) / 2087)}
        className={styles.logoWord}
        priority={priority}
      />
    </span>
  )
}
