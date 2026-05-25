// Prompt user to record their reminder message after the beep
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  twimlResponse,
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

  const sessionParams =
    `userId=${userId}` +
    `&userName=${encodeURIComponent(userName)}` +
    `&scheduledAt=${encodeURIComponent(scheduledAt)}` +
    `&callbackNumber=${encodeURIComponent(callbackNumber)}`

  // Escape all & in URLs before embedding in XML attributes
  const xmlAttr = (url: string) => url.replace(/&/g, '&amp;')
  const actionUrl = xmlAttr(`${BASE_URL}/voice-confirm-reminder?${sessionParams}&source=keypress`)
  const statusUrl = xmlAttr(`${BASE_URL}/voice-confirm-reminder?${sessionParams}&source=hangup`)

  LOG('return-2')
  return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Google.en-US-Neural2-D">Please leave your reminder message after the tone. Press pound when finished to review your message, or simply hang up to save it immediately.</Say>
  <Record action="${actionUrl}" method="POST" maxLength="120" finishOnKey="#" playBeep="true" recordingStatusCallback="${statusUrl}" recordingStatusCallbackMethod="POST"/>
  <Hangup/>
</Response>`)
})
