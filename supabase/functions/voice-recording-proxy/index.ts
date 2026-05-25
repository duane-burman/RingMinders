// Proxy Twilio recording URLs — fetches with Twilio credentials, streams audio to browser
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { encode } from 'https://deno.land/std@0.168.0/encoding/base64.ts'
import { corsHeaders } from '../_shared/twilio.ts'

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID')!
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')!

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const url = new URL(req.url)
  const recordingUrl = url.searchParams.get('url')

  if (!recordingUrl) {
    return new Response('Missing url parameter', { status: 400 })
  }

  // Only proxy Twilio recording URLs
  if (!recordingUrl.startsWith('https://api.twilio.com/') && !recordingUrl.startsWith('https://api.twilio.com')) {
    return new Response('Invalid recording URL', { status: 400 })
  }

  // Fetch the recording from Twilio with Basic Auth credentials
  const credentials = encode(new TextEncoder().encode(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`))
  const response = await fetch(recordingUrl, {
    headers: {
      'Authorization': `Basic ${credentials}`,
    },
  })

  if (!response.ok) {
    return new Response(`Failed to fetch recording: ${response.status}`, { status: response.status })
  }

  const contentType = response.headers.get('Content-Type') ?? 'audio/mpeg'
  const audioData = await response.arrayBuffer()

  return new Response(audioData, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=3600',
      ...corsHeaders,
    },
  })
})
