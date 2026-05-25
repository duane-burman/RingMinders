// Parse speech or DTMF date/time input; route to confirmation
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  twimlResponse,
  gather,
  parseSpeechDateTime,
  sayDateTime,
  corsHeaders,
} from '../_shared/twilio.ts'
import { supabaseAdmin } from '../_shared/supabase.ts'

const BASE_URL = `${Deno.env.get('SUPABASE_URL')}/functions/v1`

const LOG = (step: string, data?: Record<string, unknown>) =>
  console.log(JSON.stringify({ fn: 'voice-parse-datetime', step, ...(data ? { data } : {}) }))


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
  const speechResult = postParams.get('SpeechResult') ?? ''

  const url = new URL(req.url)
  const userId = url.searchParams.get('userId') ?? ''
  const userName = url.searchParams.get('userName') ?? ''
  const callerNumber = url.searchParams.get('callerNumber') ?? ''

  const sessionParams = `userId=${userId}&userName=${encodeURIComponent(userName)}&callerNumber=${encodeURIComponent(callerNumber)}`
  const reEntryUrl = `${BASE_URL}/voice-enter-datetime?${sessionParams}&error=invalid`
  const speechFailUrl = `${BASE_URL}/voice-enter-datetime?${sessionParams}&error=speech_failed`

  LOG('params', { userId, hasSpeech: !!speechResult, digits_len: digits.length })

  // ── Speech path ───────────────────────────────────────────────────────────
  if (speechResult) {
    LOG('speech-path', { speechResult })

    // Fetch user timezone to interpret the spoken time correctly
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('timezone')
      .eq('id', userId)
      .single()
    const timezone = user?.timezone ?? 'America/New_York'

    const parsed = parseSpeechDateTime(speechResult, timezone)
    if (!parsed) {
      LOG('return-speech-parse-failed')
      return twimlResponse(redirect(speechFailUrl))
    }

    const isoString = parsed.toISOString()

    if (new Date(isoString).getTime() <= Date.now()) {
      LOG('return-speech-past')
      return twimlResponse(redirect(`${BASE_URL}/voice-enter-datetime?${sessionParams}&error=past`))
    }

    const spoken = sayDateTime(isoString, timezone)
    LOG('return-speech-confirm', { isoString })
    return twimlResponse(gather({
      action: `${BASE_URL}/voice-datetime-confirmed?${sessionParams}&scheduledAt=${encodeURIComponent(isoString)}`,
      numDigits: 1,
      finishOnKey: '',
      message: `You said ${spoken}. Press pound to confirm or press star to re-enter.`,
    }))
  }

  // ── DTMF path ─────────────────────────────────────────────────────────────
  // Accept 3 parts (month*day*time) or 4 parts (month*day*year*time)
  LOG('dtmf-path', { digits_len: digits.length, parts_count: digits.split('*').length })
  const parts = digits.split('*')
  if (parts.length !== 3 && parts.length !== 4) {
    LOG('return-2')
    return twimlResponse(redirect(reEntryUrl))
  }

  const [monthStr, dayStr, yearOrTimeStr, maybetimeStr] = parts
  const month = parseInt(monthStr, 10)
  const day = parseInt(dayStr, 10)

  let year: number
  let timeStr: string
  if (parts.length === 4) {
    year = parseInt(yearOrTimeStr, 10)
    timeStr = maybetimeStr
  } else {
    // 3-part format: infer year — use current year, bump if date already passed
    timeStr = yearOrTimeStr
    const currentYear = new Date().getFullYear()
    let inferredYear = currentYear
    const testDate = new Date(Date.UTC(currentYear, month - 1, day))
    if (testDate < new Date()) {
      inferredYear = currentYear + 1
    }
    year = inferredYear
  }

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
    LOG('return-3')
    return twimlResponse(redirect(reEntryUrl))
  }

  // Prompt for AM/PM — store parsed components in action URL
  const datetimeParams = `month=${month}&day=${day}&year=${year}&hour=${hour}&minute=${minute}`
  LOG('return-4')
  return twimlResponse(gather({
    action: `${BASE_URL}/voice-confirm-datetime?${sessionParams}&${datetimeParams}`,
    numDigits: 1,
    message: 'Press 1 for A.M. or press 2 for P.M.',
  }))
})
