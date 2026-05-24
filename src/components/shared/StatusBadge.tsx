// Renders a colored badge for reminder and user status values
import { cn } from '@/lib/utils'

type Status = 'pending' | 'in_progress' | 'delivered' | 'voicemail' | 'missed' | 'heard' | 'cancelled' | 'expired' | 'active' | 'suspended' | 'disabled'

const statusStyles: Record<Status, string> = {
  pending:     'bg-gray-100 text-gray-600',
  in_progress: 'bg-teal-50 text-teal-600',
  delivered:   'bg-green-50 text-green-600',
  voicemail:   'bg-amber-50 text-amber-600',
  missed:      'bg-red-50 text-red-600',
  heard:       'bg-gray-100 text-gray-600',
  cancelled:   'bg-gray-100 text-gray-600',
  expired:     'bg-red-50 text-red-600',
  active:      'bg-green-50 text-green-600',
  suspended:   'bg-amber-50 text-amber-600',
  disabled:    'bg-red-50 text-red-600',
}

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize', statusStyles[status])}>
      {status.replace('_', ' ')}
    </span>
  )
}
