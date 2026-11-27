import Image from 'next/image'
import styles from './logo.module.css'
// A static import, so the wordmark's URL is hashed and caches for good.
import wordmark from '@/public/brand/wordmark-navy.png'

/*
  Freddie's Housepost logo. The house is redrawn from logo-icon.png at its own
  proportions (a 3000-unit square). It is all navy: the orange inner house came
  out on 24 Nov (Freddie wasn't sure about it). The lettering is his original
  artwork, cropped tight.
*/
export const HOUSE_OUTLINE =
  'M1500 0L3000 1500V1703H2522V3000H1704V2300H1295V3000H475V1703H0V1500Z' +
  'M1500 289L289 1500H678V2796H1092V2097H1907V2796H2320V1500H2711Z'
export const HOUSE_WINDOW = 'M1500 934L1907 1341V1813H1092V1341Z' + 'M1500 1221L1295 1426V1611H1704V1426Z'

export function HouseMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 3000 3000" className={className} aria-hidden="true" focusable="false">
      <path d={HOUSE_OUTLINE} fill="#132251" fillRule="evenodd" />
      <path d={HOUSE_WINDOW} fill="#132251" fillRule="evenodd" />
    </svg>
  )
}

export function Logo({ size = 'md', className }: { size?: 'sm' | 'md'; className?: string }) {
  return (
    <span className={`${styles.logo} ${size === 'sm' ? styles.sm : ''} ${className ?? ''}`}>
      <HouseMark className={styles.mark} />
      <Image src={wordmark} alt="Housepost" width={2087} height={386} className={styles.word} priority />
    </span>
  )
}
