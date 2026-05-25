// Prompt user to enter date/time via speech or DTMF (month*day*time# or month*day*year*time#)
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  twimlResponse,
  gatherSpeechAndDtmf,
  corsHeaders,
} from '../_shared/twilio.ts'

const BASE_URL = `${Deno.env.get('SUPABASE_URL')}/functions/v1`

const LOG = (step: string, data?: Record<string, unknown>) =>
  console.log(JSON.stringify({ fn: 'voice-enter-datetime', step, ...(data ? { data } : {}) }))


const MAIN_PROMPT =
  'Please say the date and time for your reminder — for example, say: June fifteenth at nine thirty a.m. ' +
  'Or use your keypad: enter the month, then press star, the day, then press star, the time, then press pound. ' +
  'For example, for June fifteenth at two thirty, enter 6 star 15 star 230 pound. ' +
  'To include a specific year, add it before the time: 6 star 15 star 2027 star 230 pound.'

const ERROR_MESSAGES: Record<string, string> = {
  invalid: 'That does not appear to be a valid date. Please try again. ',
  past: 'That date and time has already passed. Please enter a future date and time. ',
  speech_failed: 'Sorry, I could not understand that date. Please try again. ',
}

serve(async (req: Request) => {
  LOG('entry', { method: req.method })

  if (req.method === 'OPTIONS') {
    LOG('return-1')
    return new Response('ok', { headers: corsHeaders })
  }


  // TODO: re-enable Twilio signature validation — see docs/PIF.md Section 15

  const url = new URL(req.url)
  const userId = url.searchParams.get('userId') ?? ''
  const userName = url.searchParams.get('userName') ?? ''
  const callerNumber = url.searchParams.get('callerNumber') ?? ''
  const error = url.searchParams.get('error') ?? ''
  LOG('params', { userId, error })

  const errorPrefix = ERROR_MESSAGES[error] ?? ''
  const message = errorPrefix + MAIN_PROMPT

  LOG('return-2')
  return twimlResponse(gatherSpeechAndDtmf({
    action: `${BASE_URL}/voice-parse-datetime?userId=${userId}&userName=${encodeURIComponent(userName)}&callerNumber=${encodeURIComponent(callerNumber)}`,
    finishOnKey: '#',
    timeout: 30,
    speechTimeout: 'auto',
    message,
  }))
})
