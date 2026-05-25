// Call status callback — handles retry logic, missed marking, voicemail confirmation
// Note: Twilio signature validation is intentionally skipped for status callbacks.
// Status callbacks use different URL signing. Validated via CallSid + CallStatus presence.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  TWILIO_PHONE_NUMBER,
  corsHeaders,
} from '../_shared/twilio.ts'
import { supabaseAdmin } from '../_shared/supabase.ts'

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const body = await req.text()
  const postParams = new URLSearchParams(body)

  const callSid = postParams.get('CallSid') ?? ''
  const callStatus = postParams.get('CallStatus') ?? ''

  // Basic validation — status callbacks must include CallSid and CallStatus
  if (!callSid || !callStatus) {
    return new Response('Bad Request', { status: 400 })
  }

  const url = new URL(req.url)
  const reminderId = url.searchParams.get('reminder_id') ?? ''

  const emptyTwiml = new Response(
    '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
    { headers: { 'Content-Type': 'text/xml', ...corsHeaders } }
  )

  if (!reminderId) return emptyTwiml

  // Fetch reminder
  const { data: reminder } = await supabaseAdmin
    .from('reminders')
    .select('id, user_id, callback_number, delivery_attempts, status')
    .eq('id', reminderId)
    .single()

  if (!reminder) return emptyTwiml

  // ── Call completed ─────────────────────────────────────────────────────────
  if (callStatus === 'completed') {
    // Update the initiated call log entry to completed
    await supabaseAdmin
      .from('call_log')
      .update({ call_status: 'completed' })
      .eq('twilio_call_sid', callSid)

    // If reminder is still in_progress, the voicemail fallthrough path was taken
    // (human path updates to 'delivered' in voice-outbound-play-message before this fires)
    if (reminder.status === 'in_progress') {
      await supabaseAdmin
        .from('reminders')
        .update({
          status: 'voicemail',
          delivery_method: 'voicemail',
          delivered_at: new Date().toISOString(),
        })
        .eq('id', reminderId)
    }

    return emptyTwiml
  }

  // ── Call failed: no-answer, busy, failed, or canceled ─────────────────────
  // delivery_attempts was already incremented by voice-process-due-reminders before call initiation
  const currentAttempts = reminder.delivery_attempts ?? 0

  // Fetch user retry settings
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('retry_max_attempts, retry_interval_minutes')
    .eq('id', reminder.user_id)
    .single()

  const maxAttempts = user?.retry_max_attempts ?? 3
  const intervalMinutes = user?.retry_interval_minutes ?? 15

  if (currentAttempts >= maxAttempts) {
    // All retries exhausted — mark missed
    await supabaseAdmin
      .from('reminders')
      .update({
        status: 'missed',
        last_attempt_at: new Date().toISOString(),
      })
      .eq('id', reminderId)
  } else {
    // Queue for retry
    const nextRetry = new Date(Date.now() + intervalMinutes * 60 * 1000).toISOString()
    await supabaseAdmin
      .from('reminders')
      .update({
        status: 'pending',
        last_attempt_at: new Date().toISOString(),
        next_retry_at: nextRetry,
      })
      .eq('id', reminderId)
  }

  // Log the failed call attempt
  await supabaseAdmin.from('call_log').insert({
    user_id: reminder.user_id,
    reminder_id: reminderId,
    direction: 'outbound',
    from_number: TWILIO_PHONE_NUMBER,
    to_number: reminder.callback_number,
    twilio_call_sid: callSid,
    call_status: callStatus,
    outcome: 'reminder_missed',
    error_message: callStatus === 'failed' ? `Twilio call failed: ${callStatus}` : null,
  })

  return emptyTwiml
})
