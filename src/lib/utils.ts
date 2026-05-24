import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '').slice(-10)
  return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`
}

export function formatDateTime(iso: string, timezone = 'America/New_York'): string {
  return new Date(iso).toLocaleString('en-US', {
    timeZone: timezone,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

export function isLockedOut(lockedUntil: string | null): boolean {
  if (!lockedUntil) return false
  return new Date(lockedUntil) > new Date()
}

interface RepeatInfo {
  is_repeating: boolean
  repeat_type: string | null
  repeat_interval_days: number | null
  repeat_days_of_week: number[] | null
  repeat_day_of_month: number | null
  repeat_week_of_month: number | null
  repeat_day_of_week: number | null
}

export function formatRepeat(reminder: RepeatInfo): string {
  if (!reminder.is_repeating || !reminder.repeat_type) return '—'

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const weeks = ['', 'First', 'Second', 'Third', 'Fourth']
  const ordinal = (n: number) => {
    const s = ['th', 'st', 'nd', 'rd']
    const v = n % 100
    return n + (s[(v - 20) % 10] || s[v] || s[0])
  }

  switch (reminder.repeat_type) {
    case 'daily':
      return `Every ${reminder.repeat_interval_days} day${reminder.repeat_interval_days === 1 ? '' : 's'}`
    case 'weekly': {
      const selected = (reminder.repeat_days_of_week ?? [])
        .sort((a: number, b: number) => a - b)
        .map((d: number) => days[d])
        .join(', ')
      return `Weekly — ${selected}`
    }
    case 'monthly_date':
      return `Monthly — ${ordinal(reminder.repeat_day_of_month!)}`
    case 'monthly_day':
      return `Monthly — ${weeks[reminder.repeat_week_of_month!]} ${days[reminder.repeat_day_of_week!]}`
    default:
      return '—'
  }
}
