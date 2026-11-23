export function LandRegistryAttribution({ className }: { className?: string }) {
  return (
    <p className={className ?? 'text-xs text-ink-2'}>
      Contains HM Land Registry data © Crown copyright and database right 2026.
      This data is licensed under the{' '}
      <a
        href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/"
        target="_blank"
        rel="noreferrer"
        className="underline hover:text-ink"
      >
        Open Government Licence v3.0
      </a>
      .
    </p>
  )
}
