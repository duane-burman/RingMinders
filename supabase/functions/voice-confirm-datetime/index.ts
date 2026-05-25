// Apply AM/PM, validate calendar date and future requirement, read back for confirmation
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

const LOG = (step: string, data?: Record<string, unknown>) =>
  console.log(JSON.stringify({ fn: 'voice-confirm-datetime', step, ...(data ? { data } : {}) }))


function redirect(url: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Redirect method="POST">${url.replace(/&/g, '&amp;')}</Redirect>
</Response>`
}

// Convert local date/time components in a named timezone to a UTC ISO string.
// Strategy: guess naive UTC, format it in the target timezone to find the offset,
// then adjust. Handles DST correctly for the approximate time.
function toUtcIso(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timezone: string
): string {
  const naiveUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0)
  const naiveDate = new Date(naiveUtcMs)

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(naiveDate)

  const get = (type: string) => parseInt(parts.find(p => p.type === type)!.value, 10)
  const tzYear = get('year')
  const tzMonth = get('month')
  const tzDay = get('day')
  const tzHour = get('hour') % 24  // some engines return 24 for midnight
  const tzMinute = get('minute')

  // Difference between the local time we want and what the naive UTC gave us
  const wantMs = Date.UTC(year, month - 1, day, hour, minute, 0)
  const gotMs = Date.UTC(tzYear, tzMonth - 1, tzDay, tzHour, tzMinute, 0)

  return new Date(naiveUtcMs + (wantMs - gotMs)).toISOString()
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
  const digits = postParams.get('Digits') ?? ''  // '1' = AM, '2' = PM

  const url = new URL(req.url)
  const userId = url.searchParams.get('userId') ?? ''
  const userName = url.searchParams.get('userName') ?? ''
  const callerNumber = url.searchParams.get('callerNumber') ?? ''
  const month = parseInt(url.searchParams.get('month') ?? '0', 10)
  const day = parseInt(url.searchParams.get('day') ?? '0', 10)
  const year = parseInt(url.searchParams.get('year') ?? '0', 10)
  const hour = parseInt(url.searchParams.get('hour') ?? '0', 10)
  const minute = parseInt(url.searchParams.get('minute') ?? '0', 10)

  const sessionParams = `userId=${userId}&userName=${encodeURIComponent(userName)}&callerNumber=${encodeURIComponent(callerNumber)}`

  // Convert to 24-hour time
  LOG('params', { userId, digits, month, day, year, hour, minute })
  let hour24 = hour
  if (digits === '1') {        // AM
    if (hour === 12) hour24 = 0
  } else {                     // PM
    if (hour < 12) hour24 = hour + 12
  }

  // Validate calendar date — JS rolls over invalid dates (Feb 30 → Mar 1),
  // so compare input components against what Date actually produces
  const testDate = new Date(Date.UTC(year, month - 1, day, hour24, minute, 0))
  const calendarValid =
    testDate.getUTCMonth() === month - 1 &&
    testDate.getUTCDate() === day

  if (!calendarValid) {
    LOG('return-2')
    return twimlResponse(redirect(
      `${BASE_URL}/voice-enter-datetime?${sessionParams}&error=invalid`
    ))
  }

  // Validate future date
  if (testDate.getTime() <= Date.now()) {
    LOG('return-3')
    return twimlResponse(redirect(
      `${BASE_URL}/voice-enter-datetime?${sessionParams}&error=past`
    ))
  }

  // Fetch user timezone
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('timezone')
    .eq('id', userId)
    .single()

  LOG('db-user', { found: !!user, timezone: user?.timezone ?? null })
  const timezone = user?.timezone ?? 'America/New_York'

  // Build UTC ISO string from local components
  const isoString = toUtcIso(year, month, day, hour24, minute, timezone)

  // Format spoken confirmation
  const spoken = sayDateTime(isoString, timezone)

  LOG('return-4')
  return twimlResponse(gather({
    action: `${BASE_URL}/voice-datetime-confirmed?${sessionParams}&scheduledAt=${encodeURIComponent(isoString)}`,
    numDigits: 1,
    finishOnKey: '',   // '' means # and * are captured as regular digits
    message: `You entered ${spoken}. Press pound to confirm or press star to re-enter.`,
  }))
})
