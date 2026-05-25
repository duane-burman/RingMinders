// Entry point for every inbound call — caller ID check and routing
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
  console.log(JSON.stringify({ fn: 'voice-inbound', step, ...(data ? { data } : {}) }))


serve(async (req: Request) => {
  LOG('entry', { method: req.method, url: req.url })

  if (req.method === 'OPTIONS') {
    LOG('return-1')
    return new Response('ok', { headers: corsHeaders })
  }

  const body = await req.text()

  // TODO: re-enable Twilio signature validation — see docs/PIF.md Section 15

  const params = new URLSearchParams(body)
  const from = params.get('From') ?? ''
  LOG('params', { from_last4: from.slice(-4) })

  const user = await lookupByPhone(from)
  LOG('db-user', { found: !!user, status: user?.status ?? null })

  if (!user) {
      LOG('return-2')
      return twimlResponse(gather({
      action: `${BASE_URL}/voice-lookup-number`,
      finishOnKey: '#',
      message: 'Thank you for calling Ring Minder. Your phone number was not recognized. If you have an account, please enter your ten-digit phone number followed by the pound key.',
    }))
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

  const twiml = gather({
    action: `${BASE_URL}/voice-verify-pin?userId=${user.userId}&userName=${encodeURIComponent(user.userName)}&callerNumber=${encodeURIComponent(from)}`,
    finishOnKey: '#',
    message: `Thank you for calling Ring Minder. Welcome back, ${user.userName}. Please enter your four-digit PIN followed by pound.`,
  })
  LOG('return-5')
  return twimlResponse(twiml)
})
