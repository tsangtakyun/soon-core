type DocumentBrandMarkProps = {
  logoBase64?: string
  companyName?: string
}

export function DocumentBrandMark({ logoBase64, companyName }: DocumentBrandMarkProps) {
  if (logoBase64) {
    return (
      <img
        src={logoBase64}
        alt="Logo"
        style={{
          height: '96px',
          maxWidth: '200px',
          objectFit: 'contain',
          borderRadius: '4px',
          display: 'block',
        }}
      />
    )
  }

  return (
    <span style={{ fontWeight: 700, fontSize: '18px' }}>
      {companyName || 'SOON Studio'}
    </span>
  )
}
