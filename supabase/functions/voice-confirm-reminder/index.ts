// Final confirmation step: play back recording, save reminder on pound, restart on star, or auto-save on hangup
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  twimlResponse,
  sayAndHang,
  sayDateTime,
  sayPhone,
  TWILIO_PHONE_NUMBER,
  corsHeaders,
} from '../_shared/twilio.ts'
import { supabaseAdmin } from '../_shared/supabase.ts'

const BASE_URL = `${Deno.env.get('SUPABASE_URL')}/functions/v1`

const LOG = (step: string, data?: Record<string, unknown>) =>
  console.log(JSON.stringify({ fn: 'voice-confirm-reminder', step, ...(data ? { data } : {}) }))


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

  // TODO: re-enable Twilio signature validation — see docs/PIF.md Section 15

  const postParams = new URLSearchParams(body)
  const digits = postParams.get('Digits') ?? ''
  const callSid = postParams.get('CallSid') ?? ''

  const url = new URL(req.url)
  const userId = url.searchParams.get('userId') ?? ''
  const userName = url.searchParams.get('userName') ?? ''
  const scheduledAt = url.searchParams.get('scheduledAt') ?? ''
  const callbackNumber = url.searchParams.get('callbackNumber') ?? ''
  const source = url.searchParams.get('source') ?? ''
  const recordingUrlFromQuery = url.searchParams.get('recordingUrl')
  const recordingDurationFromQuery = url.searchParams.get('recordingDuration') ?? ''

  LOG('params', { userId, digits, scheduledAt, source, hasRecordingUrlInQuery: !!recordingUrlFromQuery })

  // ── Scenario C: hangup path — auto-save without playback or confirmation ──
  // recordingStatusCallback fires asynchronously for every recording, including
  // keypress completions, so check for an existing reminder before inserting.
  if (source === 'hangup') {
    const recordingUrl = postParams.get('RecordingUrl') ?? ''
    const recordingDuration = postParams.get('RecordingDuration') ?? null

    if (!recordingUrl) {
      LOG('return-hangup-no-recording')
      return new Response('ok', { status: 200 })
    }

    // Idempotency guard — prevent double-save when keypress path already confirmed
    const { data: existing } = await supabaseAdmin
      .from('reminders')
      .select('id')
      .eq('user_id', userId)
      .eq('scheduled_at', scheduledAt)
      .maybeSingle()

    if (existing) {
      LOG('return-hangup-already-saved')
      return new Response('ok', { status: 200 })
    }

    await supabaseAdmin.from('reminders').insert({
      user_id: userId,
      scheduled_at: scheduledAt,
      callback_number: callbackNumber,
      recording_url: recordingUrl,
      recording_duration: recordingDuration ? parseInt(recordingDuration) : null,
      status: 'pending',
      source: 'ivr',
      is_repeating: false,
    })

    await supabaseAdmin.from('call_log').insert({
      user_id: userId,
      direction: 'inbound',
      from_number: callbackNumber,
      to_number: TWILIO_PHONE_NUMBER,
      twilio_call_sid: postParams.get('CallSid') ?? '',
      call_status: 'completed',
      outcome: 'reminder_created',
    })

    LOG('return-hangup-autosave')
    return new Response('ok', { status: 200 })
  }

  // Fetch user timezone for spoken date formatting
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('timezone')
    .eq('id', userId)
    .single()
  LOG('db-user', { found: !!user })
  const timezone = user?.timezone ?? 'America/New_York'

  // ── Scenario B: user pressed a key after playback ──────────────────────────
  // Detected by presence of recordingUrl in URL params (set by Scenario A)
  if (recordingUrlFromQuery) {
    const recordingUrl = recordingUrlFromQuery
    const recordingDuration = recordingDurationFromQuery

    // Star — start over from date/time entry
    if (digits === '*') {
      LOG('return-2')
      return twimlResponse(redirect(
        `${BASE_URL}/voice-enter-datetime?userId=${userId}&userName=${encodeURIComponent(userName)}&callerNumber=${encodeURIComponent(callbackNumber)}`
      ))
    }

    // Pound (or any key) — save the reminder
    LOG('saving-reminder', { scheduledAt, callbackLast4: callbackNumber.slice(-4) })
    const { error: insertError } = await supabaseAdmin.from('reminders').insert({
      user_id: userId,
      scheduled_at: scheduledAt,
      callback_number: callbackNumber,
      recording_url: recordingUrl,
      recording_duration: recordingDuration ? parseInt(recordingDuration, 10) : null,
      status: 'pending',
      source: 'ivr',
      is_repeating: false,
    })

    LOG('save-result', { error: insertError?.message ?? null })
    if (insertError) {
      LOG('return-3')
      return twimlResponse(sayAndHang(
        'We encountered an error saving your reminder. Please try again. Goodbye.'
      ))
    }

    // Log the inbound call
    await supabaseAdmin.from('call_log').insert({
      user_id: userId,
      direction: 'inbound',
      from_number: callbackNumber,
      to_number: TWILIO_PHONE_NUMBER,
      twilio_call_sid: callSid,
      call_status: 'completed',
      outcome: 'reminder_created',
    })

    const spoken = sayDateTime(scheduledAt, timezone)
    const spokenCallback = sayPhone(callbackNumber)

    LOG('return-4')
    return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Google.en-US-Neural2-F">Your reminder has been saved. You will receive a call at ${spokenCallback} on ${spoken}. Press 1 to create another reminder, or hang up to end the call. Thank you for using the Reminder Service.</Say>
  <Gather input="dtmf" numDigits="1" action="${BASE_URL}/voice-main-menu?userId=${userId}&amp;userName=${encodeURIComponent(userName)}&amp;callerNumber=${encodeURIComponent(callbackNumber)}" method="POST" timeout="10">
  </Gather>
  <Hangup/>
</Response>`)
  }

  // ── Scenario A: first arrival after recording completes ────────────────────
  // Twilio POSTs RecordingUrl and RecordingDuration after recording finishes
  const recordingUrl = postParams.get('RecordingUrl') ?? ''
  const recordingDuration = postParams.get('RecordingDuration') ?? '0'

  if (!recordingUrl) {
    LOG('return-5')
    return twimlResponse(sayAndHang(
      'We did not receive your recording. Please try again. Goodbye.'
    ))
  }

  const spoken = sayDateTime(scheduledAt, timezone)

  LOG('return-6')
  return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="dtmf" numDigits="1" finishOnKey="" action="${BASE_URL}/voice-confirm-reminder?userId=${userId}&amp;userName=${encodeURIComponent(userName)}&amp;scheduledAt=${encodeURIComponent(scheduledAt)}&amp;callbackNumber=${encodeURIComponent(callbackNumber)}&amp;recordingUrl=${encodeURIComponent(recordingUrl)}&amp;recordingDuration=${recordingDuration}" method="POST" timeout="15">
    <Say voice="Google.en-US-Neural2-F">Your reminder is set for ${spoken}. Here is your message:</Say>
    <Play>${recordingUrl}</Play>
    <Say voice="Google.en-US-Neural2-F">Press pound to confirm and save this reminder. Press star to start over.</Say>
  </Gather>
  <Hangup/>
</Response>`)
})
