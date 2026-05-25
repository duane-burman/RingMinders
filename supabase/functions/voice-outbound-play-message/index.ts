// Play reminder message to human; mark delivered on first arrival; handle repeat/final-play
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  validateTwilioSignature,
  twimlResponse,
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
  const reminderId = url.searchParams.get('reminder_id') ?? ''
  // 'played' is set in the Gather action URL after first delivery — indicates user is in repeat/exit flow
  const played = url.searchParams.get('played') === 'true'

  // ── User is responding after playback ──────────────────────────────────────
  if (played && digits) {
    if (digits === '1') {
      // Repeat — restart the play sequence (no 'played' flag, triggers fresh play + re-Gather)
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

      return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${reminder?.recording_url ?? ''}</Play>
  <Hangup/>
</Response>`)
    }

    // Any other key — end call
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

  return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="dtmf" numDigits="1" timeout="15" action="${BASE_URL}/voice-outbound-play-message?reminder_id=${reminderId}&played=true" method="POST">
    <Say voice="alice">Here is your reminder:</Say>
    <Play>${reminder.recording_url}</Play>
    <Say voice="alice">Press 1 to repeat this message. Press 2 to hear the message one more time and then end the call. Or simply hang up when finished.</Say>
  </Gather>
  <Hangup/>
</Response>`)
})
