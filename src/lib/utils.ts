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
