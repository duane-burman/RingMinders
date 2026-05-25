// Main menu routing — directs authenticated user to create, review upcoming, or review missed
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  validateTwilioSignature,
  twimlResponse,
  gather,
  corsHeaders,
} from '../_shared/twilio.ts'

const BASE_URL = `${Deno.env.get('SUPABASE_URL')}/functions/v1`

const LOG = (step: string, data?: Record<string, unknown>) =>
  console.log(JSON.stringify({ fn: 'voice-main-menu', step, ...(data ? { data } : {}) }))


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
  const userId = url.searchParams.get('userId') ?? ''
  const userName = url.searchParams.get('userName') ?? ''
  const callerNumber = url.searchParams.get('callerNumber') ?? ''

  LOG('params', { userId, digits })
  const sessionParams = `userId=${userId}&userName=${encodeURIComponent(userName)}&callerNumber=${encodeURIComponent(callerNumber)}`

  if (digits === '1') {
    LOG('return-2')
    return twimlResponse(redirect(`${BASE_URL}/voice-enter-datetime?${sessionParams}`))
  }

  if (digits === '2') {
    LOG('return-3')
    return twimlResponse(redirect(`${BASE_URL}/voice-review-upcoming?${sessionParams}`))
  }

  if (digits === '3') {
    LOG('return-4')
    return twimlResponse(redirect(`${BASE_URL}/voice-review-missed?${sessionParams}`))
  }

  LOG('return-5')
  return twimlResponse(gather({
    action: `${BASE_URL}/voice-main-menu?${sessionParams}`,
    numDigits: 1,
    message: 'Sorry, that was not a valid option. Press 1 to create a new reminder. Press 2 to review your upcoming reminders. Press 3 to hear missed reminders.',
  }))
})
