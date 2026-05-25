// Play reminder message to human; mark delivered on first arrival; handle repeat/final-play
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  twimlResponse,
  corsHeaders,
} from '../_shared/twilio.ts'
import { supabaseAdmin } from '../_shared/supabase.ts'

const BASE_URL = `${Deno.env.get('SUPABASE_URL')}/functions/v1`

const LOG = (step: string, data?: Record<string, unknown>) =>
  console.log(JSON.stringify({ fn: 'voice-outbound-play-message', step, ...(data ? { data } : {}) }))


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
  const reminderId = url.searchParams.get('reminder_id') ?? ''
  // 'played' is set in the Gather action URL after first delivery — indicates user is in repeat/exit flow
  const played = url.searchParams.get('played') === 'true'
  LOG('params', { reminderId, played, hasDigits: !!digits })

  // ── User is responding after playback ──────────────────────────────────────
  if (played && digits) {
    if (digits === '1') {
      // Repeat — restart the play sequence (no 'played' flag, triggers fresh play + re-Gather)
      LOG('return-2')
      return twimlResponse(redirect(
        `${BASE_URL}/voice-outbound-play-message?reminder_id=${reminderId}`
      ))
    }

    if (digits === '2') {
      // Play once more then hang up
      const { data: reminder } = await supabaseAdmin
        .from('reminders')
        .select('recording_url')
        .eq('id', reminderId)
        .single()

      const playUrl3 = `${BASE_URL}/voice-recording-proxy?url=${encodeURIComponent(reminder?.recording_url ?? '')}`
      LOG('return-3')
      return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${playUrl3}</Play>
  <Hangup/>
</Response>`)
    }

    // Any other key — end call
    LOG('return-4')
    return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Hangup/>
</Response>`)
  }

  // ── First arrival (or repeat redirect with no 'played' flag) ───────────────
  const { data: reminder } = await supabaseAdmin
    .from('reminders')
    .select('recording_url')
    .eq('id', reminderId)
    .single()

  if (!reminder) {
    LOG('return-5')
    return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Hangup/>
</Response>`)
  }

  // Mark delivered — idempotent update, safe if called on repeat
  await supabaseAdmin
    .from('reminders')
    .update({
      status: 'delivered',
      delivery_method: 'human',
      delivered_at: new Date().toISOString(),
    })
    .eq('id', reminderId)

  const playUrl6 = `${BASE_URL}/voice-recording-proxy?url=${encodeURIComponent(reminder.recording_url)}`
  LOG('return-6')
  return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="dtmf" numDigits="1" timeout="15" action="${BASE_URL}/voice-outbound-play-message?reminder_id=${reminderId}&amp;played=true" method="POST">
    <Say voice="Google.en-US-Neural2-F">Here is your reminder:</Say>
    <Play>${playUrl6}</Play>
    <Say voice="Google.en-US-Neural2-F">Press 1 to repeat this message. Press 2 to hear the message one more time and then end the call. Or simply hang up when finished.</Say>
  </Gather>
  <Hangup/>
</Response>`)
})
