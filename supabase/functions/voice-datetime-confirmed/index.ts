// Handle pound (confirm) or star (re-enter) response from datetime confirmation
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  validateTwilioSignature,
  twimlResponse,
  gather,
  corsHeaders,
} from '../_shared/twilio.ts'

const BASE_URL = `${Deno.env.get('SUPABASE_URL')}/functions/v1`

const LOG = (step: string, data?: Record<string, unknown>) =>
  console.log(JSON.stringify({ fn: 'voice-datetime-confirmed', step, ...(data ? { data } : {}) }))


function redirect(url: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Redirect method="POST">${url.replace(/&/g, '&amp;')}</Redirect>
</Response>`
}

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
  const scheduledAt = url.searchParams.get('scheduledAt') ?? ''

  LOG('params', { userId, digits, scheduledAt })
  const sessionParams = `userId=${userId}&userName=${encodeURIComponent(userName)}&callerNumber=${encodeURIComponent(callerNumber)}`

  // Star — re-enter date/time from scratch
  if (digits === '*') {
    LOG('return-2')
    return twimlResponse(redirect(
      `${BASE_URL}/voice-enter-datetime?${sessionParams}`
    ))
  }

  // Pound (or any other key) — confirmed, proceed to callback number selection
  LOG('return-3')
  return twimlResponse(gather({
    action: `${BASE_URL}/voice-choose-callback?${sessionParams}&scheduledAt=${encodeURIComponent(scheduledAt)}`,
    numDigits: 1,
    message: 'Press 1 to receive the reminder on the number you are calling from. Press 2 to enter a different number.',
  }))
})
