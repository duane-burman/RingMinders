// List and navigate missed/voicemail reminders; mark as heard or keep unheard
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  validateTwilioSignature,
  twimlResponse,
  gather,
  sayDateTime,
  corsHeaders,
} from '../_shared/twilio.ts'
import { supabaseAdmin } from '../_shared/supabase.ts'

const BASE_URL = `${Deno.env.get('SUPABASE_URL')}/functions/v1`

function redirect(url: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Redirect method="POST">${url}</Redirect>
</Response>`
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const body = await req.text()

  const isValid = await validateTwilioSignature(req, body)
  if (!isValid) {
    return new Response('Forbidden', { status: 403 })
  }

  const postParams = new URLSearchParams(body)
  const digits = postParams.get('Digits') ?? ''

  const url = new URL(req.url)
  const userId = url.searchParams.get('userId') ?? ''
  const userName = url.searchParams.get('userName') ?? ''
  const callerNumber = url.searchParams.get('callerNumber') ?? ''
  const page = parseInt(url.searchParams.get('page') ?? '0', 10)
  const reminderIdsRaw = url.searchParams.get('reminderIds')

  const sessionParams = `userId=${userId}&userName=${encodeURIComponent(userName)}&callerNumber=${encodeURIComponent(callerNumber)}`

  // ── User is selecting from an already-displayed list ──────────────────────
  if (reminderIdsRaw) {
    const reminderIds: string[] = JSON.parse(reminderIdsRaw)

    // Press 0 — load next page
    if (digits === '0') {
      return twimlResponse(redirect(
        `${BASE_URL}/voice-review-missed?${sessionParams}&page=${page + 1}`
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
        return twimlResponse(redirect(`${BASE_URL}/voice-review-missed?${sessionParams}`))
      }

      return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="dtmf" numDigits="1" finishOnKey="" action="${BASE_URL}/voice-reminder-action?${sessionParams}&reminderId=${selectedId}&scheduledAt=${encodeURIComponent(reminder.scheduled_at)}&returnTo=missed" method="POST" timeout="10">
    <Play>${reminder.recording_url}</Play>
    <Say voice="alice">Press pound to mark as heard and return to your reminders. Press star to keep it as unheard.</Say>
  </Gather>
  <Hangup/>
</Response>`)
    }

    // Invalid digit — restart list from page 0
    return twimlResponse(redirect(`${BASE_URL}/voice-review-missed?${sessionParams}`))
  }

  // ── First arrival or page navigation — query and build list ───────────────
  const offset = page * 9
  const { data: reminders } = await supabaseAdmin
    .from('reminders')
    .select('id, scheduled_at')
    .eq('user_id', userId)
    .in('status', ['missed', 'voicemail'])
    .order('scheduled_at', { ascending: true })
    .range(offset, offset + 8)

  const reminderList = reminders ?? []

  if (reminderList.length === 0) {
    return twimlResponse(gather({
      action: `${BASE_URL}/voice-main-menu?${sessionParams}`,
      numDigits: 1,
      message: 'You have no missed reminders. Press 1 to create a new reminder, or hang up to end the call.',
    }))
  }

  // Fetch user timezone for date formatting
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('timezone')
    .eq('id', userId)
    .single()
  const timezone = user?.timezone ?? 'America/New_York'

  let prompt = `You have ${reminderList.length} missed reminder${reminderList.length !== 1 ? 's' : ''}. `
  reminderList.forEach((r, i) => {
    const spoken = sayDateTime(r.scheduled_at, timezone)
    prompt += `Reminder ${i + 1}: ${spoken}. Press ${i + 1} to hear this message. `
  })
  if (reminderList.length === 9) {
    prompt += 'Press 0 to hear more reminders.'
  }

  const newReminderIds = JSON.stringify(reminderList.map(r => r.id))

  return twimlResponse(gather({
    action: `${BASE_URL}/voice-review-missed?${sessionParams}&page=${page}&reminderIds=${encodeURIComponent(newReminderIds)}`,
    numDigits: 1,
    message: prompt,
  }))
})
