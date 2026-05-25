// Proxies Twilio recording URLs with authentication so <Play> can access them
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

  // Append .mp3 if not already present to get the audio content directly
  const audioUrl = recordingUrl.endsWith('.mp3') ? recordingUrl : `${recordingUrl}.mp3`

  try {
    const credentials = encode(new TextEncoder().encode(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`))

    const response = await fetch(audioUrl, {
      headers: {
        'Authorization': `Basic ${credentials}`,
      }
    })

    if (!response.ok) {
      console.error(`Recording proxy failed: ${response.status} ${audioUrl}`)
      return new Response('Recording not found', { status: 404 })
    }

    const audioData = await response.arrayBuffer()

    return new Response(audioData, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Access-Control-Allow-Origin': '*',
      }
    })
  } catch (err) {
    console.error('Recording proxy error:', err)
    return new Response('Error fetching recording', { status: 500 })
  }
})
