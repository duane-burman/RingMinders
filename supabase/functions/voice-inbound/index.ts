// Entry point for every inbound call — caller ID check and routing
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
  const from = params.get('From') ?? ''

  const user = await lookupByPhone(from)

  if (!user) {
    return twimlResponse(gather({
      action: `${BASE_URL}/voice-lookup-number`,
      finishOnKey: '#',
      message: 'Thank you for calling the Reminder Service. This call may be recorded. Your phone number was not recognized. If you have an account, please enter your ten-digit phone number followed by the pound key.',
    }))
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
    action: `${BASE_URL}/voice-verify-pin?userId=${user.userId}&userName=${encodeURIComponent(user.userName)}&callerNumber=${encodeURIComponent(from)}`,
    numDigits: 4,
    message: 'Thank you for calling the Reminder Service. This call may be recorded. Welcome back. Please enter your four-digit PIN.',
  }))
})
