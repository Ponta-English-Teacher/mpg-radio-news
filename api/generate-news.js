import OpenAI from 'openai'

// Instantiated lazily inside the handler so a missing key at import time
// doesn't crash the module during cold starts before the env check runs.
let _client = null
function getClient() {
  if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return _client
}

const SYSTEM_PROMPT = `You are a radio news script writer for an English language learning app used by Japanese university students (CEFR B1–B2 level).

Your task is to convert student-provided keywords into a short, natural-sounding radio news script that is easy to read aloud.

Rules:
- Write in plain, natural broadcast English. Short sentences only (10–15 words each).
- Do NOT list or repeat keywords — turn them into a real news story.
- CEFR B1–B2 vocabulary: no academic or overly formal language.
- MAIN NEWS must be exactly 3–4 sentences and 60–90 words total.
- Each sentence must be short and easy to say smoothly in one breath.
- If the topic involves death, accidents, or crime: use a serious, respectful, factual tone.
- Avoid graphic, shocking, or inappropriate content.
- Follow this sentence structure:
  Sentence 1: What happened (the main event)
  Sentence 2: Where and when it happened
  Sentence 3: The result or impact
  Sentence 4 (optional): A quote, authority response, or follow-up detail

You must respond with ONLY valid JSON — no markdown, no code fences, no extra text.

JSON format:
{
  "headline": "Short news headline (7–12 words, title case)",
  "mainNews": "The main news body (60–90 words, 3–4 short sentences, breaking news radio style)",
  "chunks": ["phrase1", "phrase2", "phrase3", "phrase4", "phrase5", "phrase6", "phrase7", "phrase8"]
}

For chunks: extract 6–10 words or short phrases from the script that are useful for pronunciation or fluency practice. Focus on multi-word phrases, not single common words.`

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { studentName, keywords } = req.body ?? {}

  if (!keywords || !keywords.trim()) {
    return res.status(400).json({ error: 'Keywords are required.' })
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'Server configuration error: API key not set.' })
  }

  const name = (studentName || '').trim() || 'Your Name'

  const userPrompt = `Student name: ${name}
Keywords: ${keywords.trim()}

Generate a radio news script based on these keywords. The student will read this script aloud for pronunciation practice.`

  try {
    const completion = await getClient().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 380,
      response_format: { type: 'json_object' },
    })

    const raw = completion.choices[0].message.content
    let parsed

    try {
      parsed = JSON.parse(raw)
    } catch {
      return res.status(500).json({ error: 'Failed to parse AI response. Please try again.' })
    }

    const { headline, mainNews, chunks } = parsed

    if (!headline || !mainNews) {
      return res.status(500).json({ error: 'Incomplete response from AI. Please try again.' })
    }

    return res.status(200).json({
      opening:  `This is MPG Radio News Station.\nI'm ${name}.`,
      topStory: `Today's top story: ${headline}.`,
      mainNews: mainNews.trim(),
      closing:  `That's all for today's news.\nThank you for tuning in to MPG Radio.`,
      headline,
      chunks: Array.isArray(chunks) ? chunks.slice(0, 10) : [],
    })
  } catch (err) {
    const status = err?.status ?? 500
    const message = err?.message ?? 'Unexpected error'
    return res.status(status).json({ error: `OpenAI error: ${message}` })
  }
}
