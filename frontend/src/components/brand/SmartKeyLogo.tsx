type SmartKeyLogoProps = {
  className?: string
  compact?: boolean
}

export function SmartKeyLogo({ className = '', compact = false }: SmartKeyLogoProps) {
  const classes = ['sk-logo', compact ? 'sk-logo-compact' : '', className].filter(Boolean).join(' ')

  return (
    <span className={classes} aria-hidden="true">
      <svg viewBox="0 0 42 42" role="img">
        <rect x="1" y="1" width="40" height="40" rx="12" />
        <path d="M12 22.5h11.2c3.1 0 5.3-2 5.3-4.8S26.3 13 23.2 13H12v16h5v-11h5.6c.7 0 1.2.4 1.2 1s-.5 1-1.2 1H12v2.5Z" />
        <path d="M21.7 29 31 13h-5.4l-9.3 16h5.4Z" />
      </svg>
    </span>
  )
}
