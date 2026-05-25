// Prompt user to enter date/time via DTMF (month*day*year*time#)
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  validateTwilioSignature,
  twimlResponse,
  gather,
  corsHeaders,
} from '../_shared/twilio.ts'

const BASE_URL = `${Deno.env.get('SUPABASE_URL')}/functions/v1`

const MAIN_PROMPT =
  'Please enter the date and time for your reminder. Enter the month, then press star, the day, then press star, the four-digit year, then press star, then the time using up to four digits. For example, for May first, twenty twenty-six at five fifteen, enter 5 star 1 star 2026 star 515. Then press pound when finished.'

const ERROR_MESSAGES: Record<string, string> = {
  invalid: 'That does not appear to be a valid date. Please try again. ',
  past: 'That date and time has already passed. Please enter a future date and time. ',
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

  const url = new URL(req.url)
  const userId = url.searchParams.get('userId') ?? ''
  const userName = url.searchParams.get('userName') ?? ''
  const callerNumber = url.searchParams.get('callerNumber') ?? ''
  const error = url.searchParams.get('error') ?? ''

  const errorPrefix = ERROR_MESSAGES[error] ?? ''
  const message = errorPrefix + MAIN_PROMPT

  return twimlResponse(gather({
    action: `${BASE_URL}/voice-parse-datetime?userId=${userId}&userName=${encodeURIComponent(userName)}&callerNumber=${encodeURIComponent(callerNumber)}`,
    finishOnKey: '#',
    timeout: 30,
    message,
  }))
})
