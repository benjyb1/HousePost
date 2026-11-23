export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { PopupsGallery } from './gallery'

// Dev only: every small popup, banner and toast in one place, with example
// props and no sign-in, for screenshots. 404s in production.
//   /dev/popups                 buttons, badges, banners, notices, toasts
//   /dev/popups?show=<name>     one dialog open (see the links on the page)
export default async function DevPopupsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  if (process.env.NODE_ENV === 'production') notFound()
  const { show } = await searchParams
  return <PopupsGallery show={typeof show === 'string' ? show : null} />
}
