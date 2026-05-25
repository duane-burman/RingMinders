// Handle pound (confirm) or star (re-enter) response from callback number confirmation
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  validateTwilioSignature,
  twimlResponse,
  corsHeaders,
} from '../_shared/twilio.ts'

const BASE_URL = `${Deno.env.get('SUPABASE_URL')}/functions/v1`

const LOG = (step: string, data?: Record<string, unknown>) =>
  console.log(JSON.stringify({ fn: 'voice-callback-confirmed', step, ...(data ? { data } : {}) }))


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
  const callbackNumber = url.searchParams.get('callbackNumber') ?? ''

  LOG('params', { userId, digits, callbackLast4: callbackNumber.slice(-4) })
  const sessionParams = `userId=${userId}&userName=${encodeURIComponent(userName)}&callerNumber=${encodeURIComponent(callerNumber)}`

  // Star — go back to callback number selection
  if (digits === '*') {
    LOG('return-2')
    return twimlResponse(redirect(
      `${BASE_URL}/voice-choose-callback?${sessionParams}&scheduledAt=${encodeURIComponent(scheduledAt)}`
    ))
  }

  // Pound (or any other key) — confirmed, proceed to recording
  LOG('return-3')
  return twimlResponse(redirect(
    `${BASE_URL}/voice-record-message?${sessionParams}&scheduledAt=${encodeURIComponent(scheduledAt)}&callbackNumber=${encodeURIComponent(callbackNumber)}`
  ))
})
