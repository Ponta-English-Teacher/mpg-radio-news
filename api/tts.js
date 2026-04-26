const VOICE_MAP = {
  'american-female': 'en-US-JennyNeural',
  'american-male':   'en-US-GuyNeural',
  'british-female':  'en-GB-LibbyNeural',
  'british-male':    'en-GB-RyanNeural',
}

function speedToRate(speed) {
  const s = parseFloat(speed) || 1.0
  if (s <= 0.8) return '-20%'
  if (s >= 1.2) return '+20%'
  return '0%'
}

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { text, accent, gender, speed } = req.body ?? {}
  if (!text?.trim()) {
    return res.status(400).json({ error: 'Text is required.' })
  }

  const key    = process.env.AZURE_SPEECH_KEY
  const region = process.env.AZURE_SPEECH_REGION
  if (!key || !region) {
    return res.status(500).json({ error: 'Azure Speech not configured.' })
  }

  const voiceKey = `${accent || 'american'}-${gender || 'male'}`
  const voice    = VOICE_MAP[voiceKey] || 'en-US-GuyNeural'
  const rate     = speedToRate(speed)

  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US"><voice name="${voice}"><prosody rate="${rate}">${escapeXml(text.trim())}</prosody></voice></speak>`

  try {
    const ttsRes = await fetch(
      `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
      {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': key,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
        },
        body: ssml,
      }
    )

    if (!ttsRes.ok) {
      const errText = await ttsRes.text()
      return res.status(ttsRes.status).json({ error: `Azure TTS error: ${errText}` })
    }

    const arrayBuffer = await ttsRes.arrayBuffer()
    const buffer      = Buffer.from(arrayBuffer)

    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Content-Length', buffer.length)
    res.send(buffer)
  } catch (err) {
    return res.status(500).json({ error: `TTS request failed: ${err.message}` })
  }
}
