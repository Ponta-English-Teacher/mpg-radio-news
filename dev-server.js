// Local dev server that mirrors the Vercel serverless function environment.
// Run alongside `npm run dev` to handle /api/* requests.
import 'dotenv/config'
import express from 'express'
import generateNews from './api/generate-news.js'
import tts from './api/tts.js'

const app = express()
app.use(express.json())

app.post('/api/generate-news', (req, res) => generateNews(req, res))
app.post('/api/tts',           (req, res) => tts(req, res))

const PORT = 3001
app.listen(PORT, () => {
  console.log(`API dev server running on http://localhost:${PORT}`)
})
