type DocumentBrandMarkProps = {
  logoBase64?: string
  companyName?: string
}

export function DocumentBrandMark({ logoBase64, companyName }: DocumentBrandMarkProps) {
  if (logoBase64) {
    return <img src={logoBase64} alt="Company logo" style={{ height: '48px', objectFit: 'contain' }} />
  }

  return (
    <span style={{ fontWeight: 700, fontSize: '18px' }}>
      {companyName || 'SOON Studio'}
    </span>
  )
}
