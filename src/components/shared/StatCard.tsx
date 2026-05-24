// Displays a single summary metric on the dashboard with colored accent
import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: number | string
  sub?: string
  icon: string
  accent: 'primary' | 'success' | 'danger' | 'warning' | 'muted'
}

const accentStyles: Record<StatCardProps['accent'], { border: string; icon: string; value: string }> = {
  primary: {
    border: 'border-l-primary',
    icon: 'text-primary',
    value: 'text-text',
  },
  success: {
    border: 'border-l-success',
    icon: 'text-success',
    value: 'text-success',
  },
  danger: {
    border: 'border-l-destructive',
    icon: 'text-destructive',
    value: 'text-destructive',
  },
  warning: {
    border: 'border-l-warning',
    icon: 'text-warning',
    value: 'text-warning',
  },
  muted: {
    border: 'border-l-border',
    icon: 'text-text-muted',
    value: 'text-text',
  },
}

export function StatCard({ label, value, sub, icon, accent }: StatCardProps) {
  const styles = accentStyles[accent]
  return (
    <div className={cn(
      'bg-surface border border-border rounded-lg p-4 border-l-4',
      styles.border
    )}>
      <i className={cn(`ti ${icon} text-lg mb-2 block`, styles.icon)} aria-hidden="true" />
      <p className="text-text-muted text-xs uppercase tracking-wide mb-1">{label}</p>
      <p className={cn('text-3xl font-semibold', styles.value)}>{value}</p>
      {sub && <p className="text-text-muted text-xs mt-1">{sub}</p>}
    </div>
  )
}
