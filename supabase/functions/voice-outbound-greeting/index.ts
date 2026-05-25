// Outbound call entry point — human vs voicemail detection via 10-second keypress window
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  validateTwilioSignature,
  twimlResponse,
  corsHeaders,
} from '../_shared/twilio.ts'
import { supabaseAdmin } from '../_shared/supabase.ts'

const BASE_URL = `${Deno.env.get('SUPABASE_URL')}/functions/v1`

const LOG = (step: string, data?: Record<string, unknown>) =>
  console.log(JSON.stringify({ fn: 'voice-outbound-greeting', step, ...(data ? { data } : {}) }))


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
  const reminderId = url.searchParams.get('reminder_id') ?? ''
  LOG('params', { reminderId, hasDigits: !!digits })

  // User pressed a key — human detected, route to message playback
  if (digits) {
    LOG('return-2')
    return twimlResponse(redirect(
      `${BASE_URL}/voice-outbound-play-message?reminder_id=${reminderId}`
    ))
  }

  // First arrival — fetch reminder and user name for voicemail fallthrough
  const { data: reminder } = await supabaseAdmin
    .from('reminders')
    .select('recording_url, user_id')
    .eq('id', reminderId)
    .single()
  LOG('db-reminder', { found: !!reminder })

  if (!reminder) {
    LOG('return-3')
    return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Hangup/>
</Response>`)
  }

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('name')
    .eq('id', reminder.user_id)
    .single()

  const userName = user?.name ?? 'a valued customer'
  const proxyUrl = `${BASE_URL}/voice-recording-proxy?url=${encodeURIComponent(reminder.recording_url)}`

  // Gather: 10-second window for keypress (human path)
  // Fallthrough after Gather: voicemail path — pause for beep, then play message
  // DB status update for voicemail is handled by voice-outbound-status on CallStatus='completed'
  // when reminder is still 'in_progress'
  LOG('return-4')
  return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="dtmf" numDigits="1" timeout="10" action="${BASE_URL}/voice-outbound-greeting?reminder_id=${reminderId}" method="POST">
    <Say voice="alice">This is the Reminder Service. Press any key to hear your message.</Say>
  </Gather>
  <Pause length="3"/>
  <Say voice="alice">This is a reminder for ${userName}.</Say>
  <Play>${proxyUrl}</Play>
  <Say voice="alice">This message was sent by the Reminder Service. Goodbye.</Say>
  <Hangup/>
</Response>`)
})
