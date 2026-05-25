// List and navigate pending reminders; play selected message; cancel via voice-reminder-action
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  twimlResponse,
  gather,
  sayDateTime,
  corsHeaders,
} from '../_shared/twilio.ts'
import { supabaseAdmin } from '../_shared/supabase.ts'

const BASE_URL = `${Deno.env.get('SUPABASE_URL')}/functions/v1`

const LOG = (step: string, data?: Record<string, unknown>) =>
  console.log(JSON.stringify({ fn: 'voice-review-upcoming', step, ...(data ? { data } : {}) }))


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

  const url = new URL(req.url)
  const userId = url.searchParams.get('userId') ?? ''
  const userName = url.searchParams.get('userName') ?? ''
  const callerNumber = url.searchParams.get('callerNumber') ?? ''
  const page = parseInt(url.searchParams.get('page') ?? '0', 10)
  const reminderIdsRaw = url.searchParams.get('reminderIds')

  LOG('params', { userId, digits, page, hasReminderIds: !!reminderIdsRaw })
  const sessionParams = `userId=${userId}&userName=${encodeURIComponent(userName)}&callerNumber=${encodeURIComponent(callerNumber)}`

  // ── User is selecting from an already-displayed list ──────────────────────
  if (reminderIdsRaw) {
    const reminderIds: string[] = JSON.parse(reminderIdsRaw)

    // Press 0 — load next page
    if (digits === '0') {
      LOG('return-2')
      return twimlResponse(redirect(
        `${BASE_URL}/voice-review-upcoming?${sessionParams}&page=${page + 1}`
      ))
    }

    const digitIndex = parseInt(digits, 10) - 1
    if (digitIndex >= 0 && digitIndex < reminderIds.length) {
      const selectedId = reminderIds[digitIndex]
      const { data: reminder } = await supabaseAdmin
        .from('reminders')
        .select('recording_url, scheduled_at')
        .eq('id', selectedId)
        .single()

      if (!reminder) {
        LOG('return-3')
        return twimlResponse(redirect(`${BASE_URL}/voice-review-upcoming?${sessionParams}`))
      }

      LOG('return-4')
      return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="dtmf" numDigits="1" finishOnKey="" action="${BASE_URL}/voice-reminder-action?${sessionParams}&amp;reminderId=${selectedId}&amp;scheduledAt=${encodeURIComponent(reminder.scheduled_at)}&amp;returnTo=upcoming" method="POST" timeout="10">
    <Play>${reminder.recording_url}</Play>
    <Say voice="Google.en-US-Neural2-F">Press pound to return to your reminders. Press star then pound to cancel this reminder.</Say>
  </Gather>
  <Hangup/>
</Response>`)
    }

    // Invalid digit — restart list from page 0
    LOG('return-5')
    return twimlResponse(redirect(`${BASE_URL}/voice-review-upcoming?${sessionParams}`))
  }

  // ── First arrival or page navigation — query and build list ───────────────
  const offset = page * 9
  const { data: reminders } = await supabaseAdmin
    .from('reminders')
    .select('id, scheduled_at')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('scheduled_at', { ascending: true })
    .range(offset, offset + 8)

  const reminderList = reminders ?? []
  LOG('db-reminders', { count: reminderList.length, page })

  if (reminderList.length === 0) {
    LOG('return-6')
    return twimlResponse(gather({
      action: `${BASE_URL}/voice-main-menu?${sessionParams}`,
      numDigits: 1,
      message: 'You have no upcoming reminders. Press 1 to create a new reminder, or hang up to end the call.',
    }))
  }

  // Fetch user timezone for date formatting
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('timezone')
    .eq('id', userId)
    .single()
  const timezone = user?.timezone ?? 'America/New_York'

  let prompt = `You have ${reminderList.length} upcoming reminder${reminderList.length !== 1 ? 's' : ''}. `
  reminderList.forEach((r, i) => {
    const spoken = sayDateTime(r.scheduled_at, timezone)
    prompt += `Reminder ${i + 1}: ${spoken}. Press ${i + 1} to hear this message. `
  })
  if (reminderList.length === 9) {
    prompt += 'Press 0 to hear more reminders.'
  }

  const newReminderIds = JSON.stringify(reminderList.map(r => r.id))

  LOG('return-7')
  return twimlResponse(gather({
    action: `${BASE_URL}/voice-review-upcoming?${sessionParams}&page=${page}&reminderIds=${encodeURIComponent(newReminderIds)}`,
    numDigits: 1,
    message: prompt,
  }))
})
