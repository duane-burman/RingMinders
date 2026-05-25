// Shared TypeScript interfaces for RingMinder Edge Functions

export interface CallerSession {
  userId: string
  userName: string
  pinHash: string
  status: string
  pinAttempts: number
  lockedUntil: string | null
  primaryPhone: string
  secondaryPhone: string | null
  timezone: string
  retryMaxAttempts: number
  retryIntervalMinutes: number
}

export interface ReminderRecord {
  id: string
  userId: string
  scheduledAt: string
  callbackNumber: string
  recordingUrl: string
  status: string
  isRepeating: boolean
  repeatType: string | null
  repeatIntervalDays: number | null
  repeatDaysOfWeek: number[] | null
  repeatDayOfMonth: number | null
  repeatWeekOfMonth: number | null
  repeatDayOfWeek: number | null
  repeatEndDate: string | null
}

export interface IvrState {
  userId?: string
  userName?: string
  callerNumber?: string
  scheduledAt?: string
  callbackNumber?: string
  callbackType?: string
  pinAttempts?: number
}
