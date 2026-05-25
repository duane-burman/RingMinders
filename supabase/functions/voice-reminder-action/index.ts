// Post-playback actions for upcoming (cancel) and missed (mark heard) reminder flows
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  twimlResponse,
  sayDateTime,
  corsHeaders,
} from '../_shared/twilio.ts'
import { supabaseAdmin } from '../_shared/supabase.ts'

const BASE_URL = `${Deno.env.get('SUPABASE_URL')}/functions/v1`

const LOG = (step: string, data?: Record<string, unknown>) =>
  console.log(JSON.stringify({ fn: 'voice-reminder-action', step, ...(data ? { data } : {}) }))


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
  const reminderId = url.searchParams.get('reminderId') ?? ''
  const scheduledAt = url.searchParams.get('scheduledAt') ?? ''
  const returnTo = url.searchParams.get('returnTo') ?? 'upcoming'

  LOG('params', { userId, digits, reminderId, returnTo })
  const sessionParams = `userId=${userId}&userName=${encodeURIComponent(userName)}&callerNumber=${encodeURIComponent(callerNumber)}`

  const listUrl = returnTo === 'missed'
    ? `${BASE_URL}/voice-review-missed?${sessionParams}`
    : `${BASE_URL}/voice-review-upcoming?${sessionParams}`

  // ── Upcoming reminder actions ──────────────────────────────────────────────
  if (returnTo === 'upcoming') {
    if (digits === '*') {
      // Cancel the reminder
      await supabaseAdmin
        .from('reminders')
        .update({ status: 'cancelled' })
        .eq('id', reminderId)

      // Fetch timezone to format spoken date in cancellation message
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('timezone')
        .eq('id', userId)
        .single()
      const timezone = user?.timezone ?? 'America/New_York'
      const spoken = sayDateTime(scheduledAt, timezone)

      LOG('return-2')
      return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Google.en-US-Neural2-D">This reminder for ${spoken} has been cancelled.</Say>
  <Redirect method="POST">${listUrl.replace(/&/g, '&amp;')}</Redirect>
</Response>`)
    }

    // Pound or any other key — return to upcoming list
    LOG('return-3')
    return twimlResponse(redirect(listUrl))
  }

  // ── Missed reminder actions ────────────────────────────────────────────────
  if (returnTo === 'missed') {
    if (digits === '#') {
      // Mark as heard
      await supabaseAdmin
        .from('reminders')
        .update({
          status: 'heard',
          heard_at: new Date().toISOString(),
        })
        .eq('id', reminderId)
    }

    // Both # (heard) and * (keep unheard) return to the missed list
    LOG('return-4')
    return twimlResponse(redirect(listUrl))
  }

  // Fallback
  LOG('return-5')
  return twimlResponse(redirect(listUrl))
})
