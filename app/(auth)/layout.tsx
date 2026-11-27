import Image from 'next/image'
import Link from 'next/link'
import { Logo } from '@/components/brand/Logo'
import { SiteFooter } from '@/components/layout/SiteFooter'
import s from './auth.module.css'
import aerialTerraces from '@/public/home/aerial-terraces.jpg'

// Sign in, sign up and the password pages share this: the homepage's aerial
// photo and line on one side, the form on the other. On a phone the photo
// becomes a short band above the form.
// Nothing here reads the request, so these pages are built once, not on every
// visit. The photo is a static import, so its URL is hashed and caches for good.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={s.page}>
      <div className={s.photo}>
        <Image src={aerialTerraces} alt="" fill priority quality={65} sizes="(max-width: 899px) 100vw, 48vw" />
        <div className={s.scrim} />
        <div className={s.photoIn}>
          <Link href="/" aria-label="Housepost home" className={s.logo}><Logo /></Link>
          <div>
            <p className={s.strap}>
              Target newly <span className={s.nw}>moved-in</span> homeowners near&nbsp;you.
            </p>
            <p className={s.sub}>Every month we find the homes that have just sold near you. You pick the ones worth a card and we post it.</p>
          </div>
        </div>
      </div>
      <div className={s.side}>
        <div className={s.formWrap}>
          <div className={s.form}>{children}</div>
        </div>
        <SiteFooter variant="portal" />
      </div>
    </div>
  )
}
