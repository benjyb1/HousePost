import { redirect } from 'next/navigation'

// Settings has been folded into Account (lead preferences moved to the Home
// filter bar). The route stays so old links, including the "Manage
// preferences" link in our emails, still land somewhere useful.
export default function SettingsPage() {
  redirect('/account')
}
