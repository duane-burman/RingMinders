// Manual phone number entry and lookup when caller ID did not match
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  twimlResponse,
  sayAndHang,
  gather,
  corsHeaders,
} from '../_shared/twilio.ts'
import { lookupByPhone, isLocked } from '../_shared/auth.ts'

const BASE_URL = `${Deno.env.get('SUPABASE_URL')}/functions/v1`

const LOG = (step: string, data?: Record<string, unknown>) =>
  console.log(JSON.stringify({ fn: 'voice-lookup-number', step, ...(data ? { data } : {}) }))


serve(async (req: Request) => {
  LOG('entry', { method: req.method })

  if (req.method === 'OPTIONS') {
    LOG('return-1')
    return new Response('ok', { headers: corsHeaders })
  }

  const body = await req.text()

  // TODO: re-enable Twilio signature validation — see docs/PIF.md Section 15

  const params = new URLSearchParams(body)
  const digits = params.get('Digits') ?? ''

  // Format as E.164
  const stripped = digits.replace(/\D/g, '')
  const formattedNumber = stripped.length === 10 ? `+1${stripped}` : `+${stripped}`
  LOG('params', { digits_len: digits.length, formatted_last4: formattedNumber.slice(-4) })

  const user = await lookupByPhone(formattedNumber)
  LOG('db-user', { found: !!user, status: user?.status ?? null })

  if (!user) {
    LOG('return-2')
    return twimlResponse(sayAndHang(
      'No account was found for that number. Please check with your administrator. Goodbye.'
    ))
  }

  if (user.status === 'suspended') {
    LOG('return-3')
    return twimlResponse(sayAndHang(
      'Your account has been suspended. Please contact your administrator. Goodbye.'
    ))
  }

  if (isLocked(user.lockedUntil)) {
    LOG('return-4')
    return twimlResponse(sayAndHang(
      'Your account is temporarily locked due to too many incorrect PIN attempts. Please try again later or contact your administrator. Goodbye.'
    ))
  }

  LOG('return-5')
  return twimlResponse(gather({
    action: `${BASE_URL}/voice-verify-pin?userId=${user.userId}&userName=${encodeURIComponent(user.userName)}&callerNumber=${encodeURIComponent(formattedNumber)}`,
    numDigits: 4,
    message: 'Thank you. Please enter your four-digit PIN.',
  }))
})
