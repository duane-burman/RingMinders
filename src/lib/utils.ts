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

// Formats a phone number as (XXX) XXX-XXXX while the user types
export function formatPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

// Converts raw 10-digit or formatted phone input to E.164. Never apply to values already from the database.
export function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('1') && digits.length === 11) return `+${digits}`
  if (digits.length === 10) return `+1${digits}`
  return phone
}

// Converts a UTC ISO string to local date and time strings in the given timezone
export function utcToLocal(isoStr: string, timezone: string): { date: string; time: string } {
  const date = new Date(isoStr)
  const datePart = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date) // "YYYY-MM-DD"

  const timePart = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date) // "HH:MM"

  return { date: datePart, time: timePart }
}

// Converts a local date+time string pair in the given timezone to a UTC ISO string
export function toUtcIso(dateStr: string, timeStr: string, timezone: string): string {
  // Treat the input as UTC to use as a reference, then find the offset
  const naiveUtc = new Date(`${dateStr}T${timeStr}:00Z`)
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const formatted = formatter.format(naiveUtc) // e.g. "2026-05-25, 05:00"
  const [localDate, localTime] = formatted.split(', ')
  const displayedMs = new Date(`${localDate}T${localTime}:00Z`).getTime()
  const correction = naiveUtc.getTime() - displayedMs
  return new Date(naiveUtc.getTime() + correction).toISOString()
}

// Returns the ordinal string for a number (1st, 2nd, 3rd, 4th…)
export function ordinal(n: number): string {
  if (n >= 11 && n <= 13) return `${n}th`
  switch (n % 10) {
    case 1: return `${n}st`
    case 2: return `${n}nd`
    case 3: return `${n}rd`
    default: return `${n}th`
  }
}

// Returns the best Twilio-compatible MIME type the current browser supports.
// Preference order: OGG/Opus (Chrome/Firefox, Twilio supports OGG), MP4 (Safari), WAV, browser default.
export function getTwilioCompatibleMimeType(): string {
  const candidates = [
    'audio/ogg;codecs=opus',
    'audio/mp4',
    'audio/wav',
  ]
  for (const type of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) return type
  }
  return ''
}

// Returns the file extension that matches a given audio MIME type.
export function getAudioExtension(mimeType: string): string {
  if (mimeType.includes('ogg')) return 'ogg'
  if (mimeType.includes('mp4')) return 'm4a'
  if (mimeType.includes('wav')) return 'wav'
  return 'webm'
}

// Shared className for native date/time inputs to match shadcn Input styling
export const dateTimeInputClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'

// Supported timezones — single source of truth for all timezone Select fields
export const TIMEZONES = [
  { value: 'America/New_York',    label: 'America/New_York' },
  { value: 'America/Chicago',     label: 'America/Chicago' },
  { value: 'America/Denver',      label: 'America/Denver' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles' },
  { value: 'America/Phoenix',     label: 'America/Phoenix' },
]

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
