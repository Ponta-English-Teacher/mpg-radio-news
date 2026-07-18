import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Keep the current interface unchanged.
// Existing accent/gender choices are mapped to OpenAI voices.
const VOICE_MAP = {
  'american-female': 'coral',
  'american-male': 'echo',
  'british-female': 'shimmer',
  'british-male': 'onyx',
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { text, accent, gender, speed } = req.body ?? {}

  if (!text?.trim()) {
    return res.status(400).json({ error: 'Text is required.' })
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'OpenAI API key is not configured.' })
  }

  const voiceKey = `${accent || 'american'}-${gender || 'male'}`
  const voice = VOICE_MAP[voiceKey] || 'echo'

  const numericSpeed = Number.parseFloat(speed)
  const speechSpeed = Number.isFinite(numericSpeed)
    ? Math.min(4, Math.max(0.25, numericSpeed))
    : 1

  try {
    const audio = await openai.audio.speech.create({
      model: 'gpt-4o-mini-tts',
      voice,
      input: text.trim(),
      speed: speechSpeed,
      response_format: 'mp3',
    })

    const buffer = Buffer.from(await audio.arrayBuffer())

    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Content-Length', buffer.length)
    res.send(buffer)
  } catch (error) {
    console.error('OpenAI TTS error:', error)

    return res.status(error.status || 500).json({
      error: `OpenAI TTS error: ${error.message}`,
    })
  }
}