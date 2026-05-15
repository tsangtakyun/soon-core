import type { ReactNode } from 'react'

interface PageHeaderProps {
  icon: string
  title: string
  subtitle?: string
  actions?: ReactNode
}

export default function PageHeader({ icon, title, subtitle, actions }: PageHeaderProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      padding: '24px 28px',
      borderBottom: '0.5px solid var(--soon-border)',
      marginBottom: '24px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '20px' }}>{icon}</span>
        <div>
          <h1 style={{
            fontSize: '22px',
            fontWeight: 600,
            color: 'var(--soon-text)',
            margin: 0,
            lineHeight: 1.3,
          }}>{title}</h1>
          {subtitle && (
            <p style={{
              fontSize: '13px',
              color: 'var(--soon-text-muted)',
              margin: '4px 0 0',
              lineHeight: 1.5,
            }}>{subtitle}</p>
          )}
        </div>
      </div>
      {actions && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {actions}
        </div>
      )}
    </div>
  )
}
