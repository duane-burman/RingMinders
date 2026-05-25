// Scheduler entry point — called by pg_cron via pg_net every 60 seconds
// Processes due reminders and initiates outbound Twilio calls
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  makeOutboundCall,
  TWILIO_PHONE_NUMBER,
  corsHeaders,
} from '../_shared/twilio.ts'
import { supabaseAdmin } from '../_shared/supabase.ts'

const BASE_URL = `${Deno.env.get('SUPABASE_URL')}/functions/v1`

interface DueReminder {
  id: string
  user_id: string
  callback_number: string
  delivery_attempts: number | null
  scheduled_at: string
  users: {
    retry_max_attempts: number
    retry_interval_minutes: number
    status: string
  } | null
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Validate scheduler secret — this endpoint is called by pg_net, not Twilio
  const authHeader = req.headers.get('Authorization')
  const expectedSecret = Deno.env.get('SCHEDULER_SECRET')
  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return new Response('Forbidden', { status: 403 })
  }

  const now = new Date().toISOString()
  const startTime = Date.now()

  // Query due reminders — status=pending, scheduled_at past, and (no retry time OR retry time past)
  const { data: rawReminders } = await supabaseAdmin
    .from('reminders')
    .select('id, user_id, callback_number, delivery_attempts, scheduled_at, users(retry_max_attempts, retry_interval_minutes, status)')
    .eq('status', 'pending')
    .lte('scheduled_at', now)
    .or(`next_retry_at.is.null,next_retry_at.lte.${now}`)
    .order('scheduled_at', { ascending: true })
    .limit(10)

  // Filter active users in code — PostgREST embedded resource filtering is unreliable here
  const reminders = ((rawReminders ?? []) as DueReminder[]).filter(r => {
    const userStatus = r.users?.status
    return userStatus === 'active'
  })

  let processed = 0
  let failed = 0

  for (const reminder of reminders) {
    // Increment delivery_attempts and mark in_progress BEFORE calling Twilio
    await supabaseAdmin
      .from('reminders')
      .update({
        status: 'in_progress',
        delivery_attempts: (reminder.delivery_attempts ?? 0) + 1,
        last_attempt_at: new Date().toISOString(),
      })
      .eq('id', reminder.id)

    const call = await makeOutboundCall({
      to: reminder.callback_number,
      from: TWILIO_PHONE_NUMBER,
      url: `${BASE_URL}/voice-outbound-greeting?reminder_id=${reminder.id}`,
      statusCallback: `${BASE_URL}/voice-outbound-status?reminder_id=${reminder.id}`,
    })

    if (call) {
      await supabaseAdmin.from('call_log').insert({
        user_id: reminder.user_id,
        reminder_id: reminder.id,
        direction: 'outbound',
        from_number: TWILIO_PHONE_NUMBER,
        to_number: reminder.callback_number,
        twilio_call_sid: call.sid,
        call_status: 'initiated',
        outcome: 'reminder_delivered',
      })
      processed++
    } else {
      // Twilio call initiation failed — revert reminder to pending so scheduler retries
      await supabaseAdmin
        .from('reminders')
        .update({ status: 'pending' })
        .eq('id', reminder.id)
      failed++
    }
  }

  // Log this scheduler execution
  await supabaseAdmin.from('scheduler_log').insert({
    reminders_due: rawReminders?.length ?? 0,
    reminders_processed: processed,
    reminders_failed: failed,
    edge_function_status: 200,
    duration_ms: Date.now() - startTime,
  })

  return new Response(JSON.stringify({ processed, failed }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
})
