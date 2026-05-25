// Caller authentication utilities
import { supabaseAdmin } from './supabase.ts'
import { CallerSession } from './types.ts'
import * as bcrypt from 'https://esm.sh/bcryptjs@2.4.3'

// Look up a user by phone number (primary or secondary)
export async function lookupByPhone(phone: string): Promise<CallerSession | null> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, name, pin_hash, status, pin_attempts, locked_until, primary_phone, secondary_phone, timezone, retry_max_attempts, retry_interval_minutes')
    .or(`primary_phone.eq.${phone},secondary_phone.eq.${phone}`)
    .neq('status', 'disabled')
    .single()

  if (error || !data) return null

  return {
    userId: data.id,
    userName: data.name,
    pinHash: data.pin_hash,
    status: data.status,
    pinAttempts: data.pin_attempts,
    lockedUntil: data.locked_until,
    primaryPhone: data.primary_phone,
    secondaryPhone: data.secondary_phone,
    timezone: data.timezone,
    retryMaxAttempts: data.retry_max_attempts,
    retryIntervalMinutes: data.retry_interval_minutes,
  }
}

// Verify a PIN against a bcrypt hash
export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash)
}

// Increment failed PIN attempts and optionally lock the account
export async function incrementPinFailures(userId: string, currentAttempts: number): Promise<void> {
  const newAttempts = currentAttempts + 1
  const shouldLock = newAttempts >= 5

  await supabaseAdmin
    .from('users')
    .update({
      pin_attempts: newAttempts,
      ...(shouldLock ? { locked_until: new Date(Date.now() + 30 * 60 * 1000).toISOString() } : {})
    })
    .eq('id', userId)
}

// Reset PIN attempts on successful auth
export async function resetPinAttempts(userId: string): Promise<void> {
  await supabaseAdmin
    .from('users')
    .update({ pin_attempts: 0 })
    .eq('id', userId)
}

// Check if account is currently locked
export function isLocked(lockedUntil: string | null): boolean {
  if (!lockedUntil) return false
  return new Date(lockedUntil) > new Date()
}
