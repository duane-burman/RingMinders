// Prompt user to record their reminder message after the beep
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  twimlResponse,
  record,
  corsHeaders,
} from '../_shared/twilio.ts'

const BASE_URL = `${Deno.env.get('SUPABASE_URL')}/functions/v1`

const LOG = (step: string, data?: Record<string, unknown>) =>
  console.log(JSON.stringify({ fn: 'voice-record-message', step, ...(data ? { data } : {}) }))


serve(async (req: Request) => {
  LOG('entry', { method: req.method })

  if (req.method === 'OPTIONS') {
    LOG('return-1')
    return new Response('ok', { headers: corsHeaders })
  }


  // TODO: re-enable Twilio signature validation — see docs/PIF.md Section 15

  const url = new URL(req.url)
  const userId = url.searchParams.get('userId') ?? ''
  const userName = url.searchParams.get('userName') ?? ''
  const scheduledAt = url.searchParams.get('scheduledAt') ?? ''
  const callbackNumber = url.searchParams.get('callbackNumber') ?? ''

  LOG('params', { userId, scheduledAt, callbackLast4: callbackNumber.slice(-4) })
  LOG('return-2')
  return twimlResponse(record({
    action: `${BASE_URL}/voice-confirm-reminder?userId=${userId}&userName=${encodeURIComponent(userName)}&scheduledAt=${encodeURIComponent(scheduledAt)}&callbackNumber=${encodeURIComponent(callbackNumber)}`,
    maxLength: 120,
    message: 'Please leave your reminder message after the tone. Press pound when you are finished, or simply hang up.',
  }))
})
