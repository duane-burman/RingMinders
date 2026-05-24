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
    bg: '#FFFFFF',
    border: '#E2E6EC',
    cardBorder: '#4ECDC4',
    iconColor: '#4ECDC4',
    valueColor: '#1A2B42',
  },
  muted: {
    bg: '#FFFFFF',
    border: '#E2E6EC',
    cardBorder: '#6B7A90',
    iconColor: '#6B7A90',
    valueColor: '#1A2B42',
  },
  success: {
    bg: '#F0FDF4',
    border: '#BBF7D0',
    cardBorder: '#3DBE6E',
    iconColor: '#3DBE6E',
    valueColor: '#3DBE6E',
  },
  danger: {
    bg: '#FEF2F2',
    border: '#FECACA',
    cardBorder: '#E05555',
    iconColor: '#E05555',
    valueColor: '#E05555',
  },
  warning: {
    bg: '#FFFBEB',
    border: '#FDE68A',
    cardBorder: '#E8A838',
    iconColor: '#E8A838',
    valueColor: '#E8A838',
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
