// PIN verification — compares entered PIN against bcrypt hash, tracks per-call attempts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  validateTwilioSignature,
  twimlResponse,
  sayAndHang,
  gather,
  corsHeaders,
} from '../_shared/twilio.ts'
import { verifyPin, incrementPinFailures, resetPinAttempts, isLocked } from '../_shared/auth.ts'
import { supabaseAdmin } from '../_shared/supabase.ts'

const BASE_URL = `${Deno.env.get('SUPABASE_URL')}/functions/v1`

const LOG = (step: string, data?: Record<string, unknown>) =>
  console.log(JSON.stringify({ fn: 'voice-verify-pin', step, ...(data ? { data } : {}) }))


serve(async (req: Request) => {
  LOG('entry', { method: req.method })

  if (req.method === 'OPTIONS') {
    LOG('return-1')
    return new Response('ok', { headers: corsHeaders })
  }

  const body = await req.text()

  // TEMPORARILY DISABLED FOR DEBUGGING — re-enable before production
  // const isValid = await validateTwilioSignature(req, body)
  // if (!isValid) {
  //   return new Response('Forbidden', { status: 403 })
  // }
  const isValid = true // temporary bypass

  const postParams = new URLSearchParams(body)
  const digits = postParams.get('Digits') ?? ''

  const url = new URL(req.url)
  const userId = url.searchParams.get('userId') ?? ''
  const userName = url.searchParams.get('userName') ?? ''
  const callerNumber = url.searchParams.get('callerNumber') ?? ''
  // per-call attempt counter passed via URL params (starts at 0, never persisted)
  const callAttempts = parseInt(url.searchParams.get('attempts') ?? '0', 10)
  LOG('params', { userId, callAttempts })

  // Fetch fresh user record to get current pin_hash and cumulative pin_attempts
  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('pin_hash, pin_attempts, locked_until')
    .eq('id', userId)
    .single()

  LOG('db-user', { found: !!user, error: error?.message ?? null })
  if (error || !user) {
    LOG('return-2')
    return twimlResponse(sayAndHang('An error occurred. Please try again later. Goodbye.'))
  }

  if (isLocked(user.locked_until)) {
    LOG('return-3')
    return twimlResponse(sayAndHang(
      'Your account is temporarily locked due to too many incorrect PIN attempts. Please try again later or contact your administrator. Goodbye.'
    ))
  }

  const correct = await verifyPin(digits, user.pin_hash)
  LOG('pin-check', { correct })

  if (correct) {
    await resetPinAttempts(userId)
    LOG('return-4')
    return twimlResponse(gather({
      action: `${BASE_URL}/voice-main-menu?userId=${userId}&userName=${encodeURIComponent(userName)}&callerNumber=${encodeURIComponent(callerNumber)}`,
      numDigits: 1,
      message: `Welcome, ${userName}. Press 1 to create a new reminder. Press 2 to review your upcoming reminders. Press 3 to hear missed reminders.`,
    }))
  }

  // PIN incorrect — increment cumulative DB counter, increment per-call counter
  await incrementPinFailures(userId, user.pin_attempts)
  const newCallAttempts = callAttempts + 1

  if (newCallAttempts >= 3) {
    LOG('return-5')
    return twimlResponse(sayAndHang(
      'Too many incorrect attempts. Please try again later or contact your administrator. Goodbye.'
    ))
  }

  LOG('return-6')
  return twimlResponse(gather({
    action: `${BASE_URL}/voice-verify-pin?userId=${userId}&userName=${encodeURIComponent(userName)}&callerNumber=${encodeURIComponent(callerNumber)}&attempts=${newCallAttempts}`,
    numDigits: 4,
    message: 'Incorrect PIN. Please try again. Enter your four-digit PIN.',
  }))
})
