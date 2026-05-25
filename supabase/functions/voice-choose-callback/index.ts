// Route caller to use their calling number or enter a custom callback number
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  validateTwilioSignature,
  twimlResponse,
  gather,
  corsHeaders,
} from '../_shared/twilio.ts'

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
  const scheduledAt = url.searchParams.get('scheduledAt') ?? ''

  const sessionParams = `userId=${userId}&userName=${encodeURIComponent(userName)}&callerNumber=${encodeURIComponent(callerNumber)}`

  if (digits === '1') {
    // Use the number they called from as the callback number
    return twimlResponse(redirect(
      `${BASE_URL}/voice-record-message?${sessionParams}&scheduledAt=${encodeURIComponent(scheduledAt)}&callbackNumber=${encodeURIComponent(callerNumber)}`
    ))
  }

  if (digits === '2') {
    // Prompt to enter a custom number
    return twimlResponse(gather({
      action: `${BASE_URL}/voice-callback-selected?${sessionParams}&scheduledAt=${encodeURIComponent(scheduledAt)}`,
      finishOnKey: '#',
      message: 'Please enter the ten-digit phone number you would like us to call, followed by the pound key.',
    }))
  }

  // Invalid input — re-prompt
  return twimlResponse(gather({
    action: `${BASE_URL}/voice-choose-callback?${sessionParams}&scheduledAt=${encodeURIComponent(scheduledAt)}`,
    numDigits: 1,
    message: 'Sorry, that was not a valid option. Press 1 to receive the reminder on the number you are calling from. Press 2 to enter a different number.',
  }))
})
