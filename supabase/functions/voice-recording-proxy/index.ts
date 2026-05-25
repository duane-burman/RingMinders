// Proxies recording URLs so Twilio <Play> can access them.
// Two cases:
//   1. Twilio API URLs (api.twilio.com) — require Basic Auth + .mp3 extension
//   2. Supabase Storage URLs — already public, fetch directly
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, corsHeaders } from '../_shared/twilio.ts'
import { encode } from 'https://deno.land/std@0.168.0/encoding/base64.ts'

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const url = new URL(req.url)
  const recordingUrl = url.searchParams.get('url')

  if (!recordingUrl) {
    return new Response('Missing url parameter', { status: 400 })
  }

  try {
    let response: Response

    if (recordingUrl.startsWith('https://api.twilio.com/')) {
      // Twilio API recording — needs Basic Auth, append .mp3 for direct audio stream
      const audioUrl = recordingUrl.endsWith('.mp3') ? recordingUrl : `${recordingUrl}.mp3`
      const credentials = encode(new TextEncoder().encode(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`))
      response = await fetch(audioUrl, {
        headers: { 'Authorization': `Basic ${credentials}` },
      })
    } else {
      // Supabase Storage or other public URL — fetch directly
      response = await fetch(recordingUrl)
    }

    if (!response.ok) {
      console.error(`Recording proxy failed: ${response.status} for ${recordingUrl}`)
      return new Response('Recording not found', { status: 404 })
    }

    const audioData = await response.arrayBuffer()
    const contentType = response.headers.get('Content-Type') ?? 'audio/mpeg'

    return new Response(audioData, {
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (err) {
    console.error('Recording proxy error:', err)
    return new Response('Error fetching recording', { status: 500 })
  }
})
