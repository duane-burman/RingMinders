// Displays a single summary metric on the dashboard
import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: number | string
  sub?: string
  valueClassName?: string
}

export function StatCard({ label, value, sub, valueClassName }: StatCardProps) {
  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <p className="text-text-muted text-xs uppercase tracking-wide mb-1">{label}</p>
      <p className={cn('text-2xl font-semibold text-text', valueClassName)}>{value}</p>
      {sub && <p className="text-text-muted text-xs mt-1">{sub}</p>}
    </div>
  )
}
