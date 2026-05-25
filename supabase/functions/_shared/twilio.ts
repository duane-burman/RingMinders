// Twilio utilities — TwiML builder, signature validation, REST API client
import { crypto } from 'https://deno.land/std@0.168.0/crypto/mod.ts'
import { encode } from 'https://deno.land/std@0.168.0/encoding/base64.ts'
import * as chrono from 'https://esm.sh/chrono-node@2.7.8'

export const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID')!
export const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')!
export const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER') ?? ''

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-twilio-signature',
}

// Validate that the request came from Twilio
export async function validateTwilioSignature(
  req: Request,
  body: string
): Promise<boolean> {
  const signature = req.headers.get('x-twilio-signature')
  if (!signature) return false

  const url = req.url
  const params = new URLSearchParams(body)
  const sortedParams = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}${v}`)
    .join('')

  const data = url + sortedParams
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(TWILIO_AUTH_TOKEN),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  )
  const signatureBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  const expected = encode(new Uint8Array(signatureBytes))

  return expected === signature
}

// Return a TwiML response
export function twimlResponse(twiml: string): Response {
  return new Response(twiml, {
    headers: { 'Content-Type': 'text/xml', ...corsHeaders }
  })
}

// Build a simple Say + Hangup TwiML
export function sayAndHang(message: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Google.en-US-Neural2-F">${message}</Say>
  <Hangup/>
</Response>`
}

// Escape & in URLs for use in XML attributes
function xmlAttr(url: string): string {
  return url.replace(/&/g, '&amp;')
}

// Build a Gather TwiML (keypad input)
export function gather(opts: {
  action: string
  numDigits?: number
  finishOnKey?: string
  timeout?: number
  message: string
}): string {
  const finishOnKey = opts.finishOnKey !== undefined ? `finishOnKey="${opts.finishOnKey}"` : ''
  const numDigits = opts.numDigits !== undefined ? `numDigits="${opts.numDigits}"` : ''
  const timeout = opts.timeout !== undefined ? `timeout="${opts.timeout}"` : 'timeout="10"'
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="dtmf" action="${xmlAttr(opts.action)}" method="POST" ${numDigits} ${finishOnKey} ${timeout}>
    <Say voice="Google.en-US-Neural2-F">${opts.message}</Say>
  </Gather>
  <Say voice="Google.en-US-Neural2-F">We did not receive any input. Goodbye.</Say>
  <Hangup/>
</Response>`
}

// Build a Record TwiML
export function record(opts: {
  action: string
  maxLength?: number
  message: string
}): string {
  const maxLength = opts.maxLength ?? 120
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Google.en-US-Neural2-F">${opts.message}</Say>
  <Record action="${xmlAttr(opts.action)}" method="POST" maxLength="${maxLength}" finishOnKey="#" playBeep="true"/>
  <Hangup/>
</Response>`
}

// Build a Play TwiML
export function playAndGather(opts: {
  action: string
  playUrl: string
  message: string
  numDigits?: number
}): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="dtmf" action="${xmlAttr(opts.action)}" method="POST" numDigits="${opts.numDigits ?? 1}" timeout="10">
    <Say voice="Google.en-US-Neural2-F">${opts.message}</Say>
    <Play>${opts.playUrl}</Play>
  </Gather>
  <Hangup/>
</Response>`
}

// Make an outbound call via Twilio REST API
export async function makeOutboundCall(opts: {
  to: string
  from: string
  url: string
  statusCallback: string
}): Promise<{ sid: string } | null> {
  const body = new URLSearchParams({
    To: opts.to,
    From: opts.from,
    Url: opts.url,
    StatusCallback: opts.statusCallback,
    StatusCallbackEvent: 'initiated ringing answered completed',
    StatusCallbackMethod: 'POST',
    Timeout: '30',
  })

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${encode(new TextEncoder().encode(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`))}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString()
    }
  )

  if (!response.ok) {
    const err = await response.text()
    console.error('Twilio outbound call failed:', err)
    return null
  }

  const data = await response.json()
  return { sid: data.sid }
}

// Format a phone number for TwiML Say (reads digits individually)
export function sayPhone(e164: string): string {
  return e164.replace('+1', '').split('').join(', ')
}

// Parse month name from number
export function monthName(month: number): string {
  return ['January','February','March','April','May','June',
          'July','August','September','October','November','December'][month - 1] ?? 'Unknown'
}

// Format a datetime for TwiML Say
export function sayDateTime(isoString: string, timezone: string): string {
  const date = new Date(isoString)
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(date)
  return formatted
}

// Parse a natural-language date/time from Twilio SpeechResult using chrono-node.
// The timezone param (e.g. 'America/New_York') is used to interpret ambiguous times
// in the caller's local time rather than UTC.
// Returns a Date (UTC) or null if parsing fails.
export function parseSpeechDateTime(text: string, timezone: string): Date | null {
  // Compute the UTC offset for this timezone at this moment
  const now = new Date()
  const localParts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric',
    hour12: false,
  }).formatToParts(now)
  const get = (type: string) => parseInt(localParts.find(p => p.type === type)!.value, 10)
  const localMs = Date.UTC(
    get('year'), get('month') - 1, get('day'),
    get('hour') % 24, get('minute'), get('second')
  )
  const offsetMinutes = Math.round((localMs - now.getTime()) / 60000)

  const result = chrono.parseDate(text, now, {
    forwardDate: true,
    timezone: offsetMinutes,
  })
  return result ?? null
}

// Build a Gather TwiML accepting both speech and DTMF simultaneously
export function gatherSpeechAndDtmf(opts: {
  action: string
  finishOnKey?: string
  timeout?: number
  speechTimeout?: number | 'auto'
  message: string
}): string {
  const finishOnKey = opts.finishOnKey !== undefined ? `finishOnKey="${opts.finishOnKey}"` : ''
  const timeout = `timeout="${opts.timeout ?? 30}"`
  const speechTimeout = `speechTimeout="${opts.speechTimeout ?? 'auto'}"`
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="dtmf speech" action="${xmlAttr(opts.action)}" method="POST" ${finishOnKey} ${timeout} ${speechTimeout}>
    <Say voice="Google.en-US-Neural2-F">${opts.message}</Say>
  </Gather>
  <Say voice="Google.en-US-Neural2-F">We did not receive any input. Goodbye.</Say>
  <Hangup/>
</Response>`
}
