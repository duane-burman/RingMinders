// Manual phone number entry and lookup when caller ID did not match
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  validateTwilioSignature,
  twimlResponse,
  sayAndHang,
  gather,
  corsHeaders,
} from '../_shared/twilio.ts'
import { lookupByPhone, isLocked } from '../_shared/auth.ts'

const BASE_URL = `${Deno.env.get('SUPABASE_URL')}/functions/v1`

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const body = await req.text()

  const isValid = await validateTwilioSignature(req, body)
  if (!isValid) {
    return new Response('Forbidden', { status: 403 })
  }

  const params = new URLSearchParams(body)
  const digits = params.get('Digits') ?? ''

  // Format as E.164
  const stripped = digits.replace(/\D/g, '')
  const formattedNumber = stripped.length === 10 ? `+1${stripped}` : `+${stripped}`

  const user = await lookupByPhone(formattedNumber)

  if (!user) {
    return twimlResponse(sayAndHang(
      'No account was found for that number. Please check with your administrator. Goodbye.'
    ))
  }

  if (user.status === 'suspended') {
    return twimlResponse(sayAndHang(
      'Your account has been suspended. Please contact your administrator. Goodbye.'
    ))
  }

  if (isLocked(user.lockedUntil)) {
    return twimlResponse(sayAndHang(
      'Your account is temporarily locked due to too many incorrect PIN attempts. Please try again later or contact your administrator. Goodbye.'
    ))
  }

  return twimlResponse(gather({
    action: `${BASE_URL}/voice-verify-pin?userId=${user.userId}&userName=${encodeURIComponent(user.userName)}&callerNumber=${encodeURIComponent(formattedNumber)}`,
    numDigits: 4,
    message: 'Thank you. Please enter your four-digit PIN.',
  }))
})
