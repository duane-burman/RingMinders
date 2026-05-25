// Format entered custom callback number, read back digits, confirm before proceeding
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  twimlResponse,
  gather,
  sayPhone,
  corsHeaders,
} from '../_shared/twilio.ts'

const BASE_URL = `${Deno.env.get('SUPABASE_URL')}/functions/v1`

const LOG = (step: string, data?: Record<string, unknown>) =>
  console.log(JSON.stringify({ fn: 'voice-callback-selected', step, ...(data ? { data } : {}) }))


serve(async (req: Request) => {
  LOG('entry', { method: req.method })

  if (req.method === 'OPTIONS') {
    LOG('return-1')
    return new Response('ok', { headers: corsHeaders })
  }

  const body = await req.text()

  // TODO: re-enable Twilio signature validation — see docs/PIF.md Section 15

  const postParams = new URLSearchParams(body)
  const digits = postParams.get('Digits') ?? ''

  const url = new URL(req.url)
  const userId = url.searchParams.get('userId') ?? ''
  const userName = url.searchParams.get('userName') ?? ''
  const callerNumber = url.searchParams.get('callerNumber') ?? ''
  const scheduledAt = url.searchParams.get('scheduledAt') ?? ''

  const sessionParams = `userId=${userId}&userName=${encodeURIComponent(userName)}&callerNumber=${encodeURIComponent(callerNumber)}`

  // Format as E.164
  LOG('params', { userId, digits_len: digits.length })
  const stripped = digits.replace(/\D/g, '')
  LOG('formatted-number', { last4: (stripped.length === 10 ? `+1${stripped}` : `+${stripped}`).slice(-4) })
  const e164Number = stripped.length === 10 ? `+1${stripped}` : `+${stripped}`

  // Read back digits individually and ask to confirm — # confirms, * re-enters
  LOG('return-2')
  return twimlResponse(gather({
    action: `${BASE_URL}/voice-callback-confirmed?${sessionParams}&scheduledAt=${encodeURIComponent(scheduledAt)}&callbackNumber=${encodeURIComponent(e164Number)}`,
    numDigits: 1,
    finishOnKey: '',  // '' means # and * are captured as regular digits
    message: `The reminder will be sent to ${sayPhone(e164Number)}. Press pound to confirm or press star to re-enter.`,
  }))
})
