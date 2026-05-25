// Displays a single summary metric on the dashboard with colored accent and optional background tint

interface StatCardProps {
  label: string
  value: number | string
  sub?: string
  icon: string
  accent: 'primary' | 'success' | 'danger' | 'warning' | 'muted'
}

const accentConfig: Record<StatCardProps['accent'], {
  bg: string
  border: string
  cardBorder: string
  iconColor: string
  valueColor: string
}> = {
  primary: {
    bg: 'var(--color-surface, #FFFFFF)',
    border: 'var(--color-border, #E2E6EC)',
    cardBorder: 'var(--color-primary, #4ECDC4)',
    iconColor: 'var(--color-primary, #4ECDC4)',
    valueColor: 'var(--color-text, #1A2B42)',
  },
  muted: {
    bg: 'var(--color-surface, #FFFFFF)',
    border: 'var(--color-border, #E2E6EC)',
    cardBorder: 'var(--color-border, #E2E6EC)',
    iconColor: 'var(--color-text-muted, #6B7A90)',
    valueColor: 'var(--color-text, #1A2B42)',
  },
  success: {
    bg: '#F0FDF4',
    border: '#BBF7D0',
    cardBorder: 'var(--color-success, #3DBE6E)',
    iconColor: 'var(--color-success, #3DBE6E)',
    valueColor: 'var(--color-success, #3DBE6E)',
  },
  danger: {
    bg: '#FEF2F2',
    border: '#FECACA',
    cardBorder: 'var(--color-destructive, #E05555)',
    iconColor: 'var(--color-destructive, #E05555)',
    valueColor: 'var(--color-destructive, #E05555)',
  },
  warning: {
    bg: '#FFFBEB',
    border: '#FDE68A',
    cardBorder: 'var(--color-warning, #E8A838)',
    iconColor: 'var(--color-warning, #E8A838)',
    valueColor: 'var(--color-warning, #E8A838)',
  },
}

export function StatCard({ label, value, sub, icon, accent }: StatCardProps) {
  const config = accentConfig[accent]
  return (
    <div
      className="rounded-lg p-4"
      style={{
        background: config.bg,
        border: `0.5px solid ${config.border}`,
        borderLeft: `4px solid ${config.cardBorder}`,
      }}
    >
      <i
        className={`ti ${icon} text-lg mb-2 block`}
        style={{ color: config.iconColor }}
        aria-hidden="true"
      />
      <p className="text-xs uppercase tracking-wide mb-1" style={{ color: '#6B7A90' }}>{label}</p>
      <p className="text-3xl font-semibold" style={{ color: config.valueColor }}>{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: '#6B7A90' }}>{sub}</p>}
    </div>
  )
}
