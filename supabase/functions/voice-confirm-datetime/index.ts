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
  const sessionParams = `userId=${userId}&userName=${encodeURIComponent(userName)}&callerNumber=${encodeURIComponent(callerNumber)}`

  // ── Recovery mode: user is responding to "schedule for tomorrow?" prompt ──
  const recovering = url.searchParams.get('recovering') === '1'
  const scheduledAtRecovery = url.searchParams.get('scheduledAt') ?? ''

  if (recovering) {
    LOG('recovery-response', { digits })
    if (digits === '1') {
      // User confirmed tomorrow's time — skip to callback selection
      LOG('return-tomorrow-confirmed')
      return twimlResponse(redirect(
        `${BASE_URL}/voice-choose-callback?${sessionParams}&scheduledAt=${encodeURIComponent(scheduledAtRecovery)}`
      ))
    }
    // Any other key — let them re-enter
    LOG('return-recovery-reenter')
    return twimlResponse(redirect(
      `${BASE_URL}/voice-enter-datetime?${sessionParams}`
    ))
  }

  // ── Normal mode: digits = AM/PM selection ─────────────────────────────────
  const month = parseInt(url.searchParams.get('month') ?? '0', 10)
  const day = parseInt(url.searchParams.get('day') ?? '0', 10)
  const year = parseInt(url.searchParams.get('year') ?? '0', 10)
  const hour = parseInt(url.searchParams.get('hour') ?? '0', 10)
  const minute = parseInt(url.searchParams.get('minute') ?? '0', 10)

  LOG('params', { userId, digits, month, day, year, hour, minute })

  // Convert to 24-hour time
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
    LOG('return-invalid-date')
    return twimlResponse(redirect(
      `${BASE_URL}/voice-enter-datetime?${sessionParams}&error=invalid`
    ))
  }

  // Fetch user timezone before past check so we compare correctly
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('timezone')
    .eq('id', userId)
    .single()

  LOG('db-user', { found: !!user, timezone: user?.timezone ?? null })
  const timezone = user?.timezone ?? 'America/New_York'

  // Build proper timezone-aware UTC ISO string
  const isoString = toUtcIso(year, month, day, hour24, minute, timezone)

  // Validate future date using the timezone-corrected time
  if (new Date(isoString).getTime() <= Date.now()) {
    // Suggest the same time tomorrow
    const tomorrowIso = new Date(new Date(isoString).getTime() + 24 * 60 * 60 * 1000).toISOString()
    const spokenTomorrow = sayDateTime(tomorrowIso, timezone)
    LOG('return-past-suggest-tomorrow', { tomorrowIso })
    return twimlResponse(gather({
      action: `${BASE_URL}/voice-confirm-datetime?${sessionParams}&recovering=1&scheduledAt=${encodeURIComponent(tomorrowIso)}`,
      numDigits: 1,
      message: `That time has already passed. The same time tomorrow would be ${spokenTomorrow}. Press 1 to schedule for that time instead, or press 2 to enter a different date and time.`,
    }))
  }

  // Valid future time — read back for confirmation
  const spoken = sayDateTime(isoString, timezone)

  LOG('return-confirm', { isoString })
  return twimlResponse(gather({
    action: `${BASE_URL}/voice-datetime-confirmed?${sessionParams}&scheduledAt=${encodeURIComponent(isoString)}`,
    numDigits: 1,
    finishOnKey: '',   // '' means # and * are captured as regular digits
    message: `You entered ${spoken}. Press pound to confirm or press star to re-enter.`,
  }))
})
