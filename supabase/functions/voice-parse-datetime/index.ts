// Parse DTMF date/time input (month*day*year*time), validate ranges, prompt for AM/PM
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

  const sessionParams = `userId=${userId}&userName=${encodeURIComponent(userName)}&callerNumber=${encodeURIComponent(callerNumber)}`
  const reEntryUrl = `${BASE_URL}/voice-enter-datetime?${sessionParams}&error=invalid`

  // Must have exactly 4 segments separated by *
  const parts = digits.split('*')
  if (parts.length !== 4) {
    return twimlResponse(redirect(reEntryUrl))
  }

  const [monthStr, dayStr, yearStr, timeStr] = parts
  const month = parseInt(monthStr, 10)
  const day = parseInt(dayStr, 10)
  const year = parseInt(yearStr, 10)

  // Parse time per PIF rules:
  // 1–2 digits: hour only (5 = 5:00)
  // 3 digits: first digit hour, last two minutes (515 = 5:15)
  // 4 digits: first two hour, last two minutes (1030 = 10:30)
  let hour: number
  let minute: number
  if (timeStr.length <= 2) {
    hour = parseInt(timeStr, 10)
    minute = 0
  } else if (timeStr.length === 3) {
    hour = parseInt(timeStr[0], 10)
    minute = parseInt(timeStr.slice(1), 10)
  } else {
    hour = parseInt(timeStr.slice(0, 2), 10)
    minute = parseInt(timeStr.slice(2), 10)
  }

  // Validate ranges (12-hour clock: hour 1–12)
  if (
    month < 1 || month > 12 ||
    day < 1 || day > 31 ||
    year < 2024 ||
    hour > 12 ||
    minute > 59
  ) {
    return twimlResponse(redirect(reEntryUrl))
  }

  // Prompt for AM/PM — store parsed components in action URL
  const datetimeParams = `month=${month}&day=${day}&year=${year}&hour=${hour}&minute=${minute}`
  return twimlResponse(gather({
    action: `${BASE_URL}/voice-confirm-datetime?${sessionParams}&${datetimeParams}`,
    numDigits: 1,
    message: 'Press 1 for A.M. or press 2 for P.M.',
  }))
})
