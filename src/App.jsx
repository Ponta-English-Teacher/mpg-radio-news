import { useState, useRef, useEffect } from 'react'
import './App.css'
import SimpleRecorder from './components/SimpleRecorder'

// ── Keyword parser ────────────────────────────────────────────────────────────

const WORD_NUMBERS = {
  one:1, two:2, three:3, four:4, five:5,
  six:6, seven:7, eight:8, nine:9, ten:10,
}

const CATEGORIES = {
  accident:  /\b(accident|crash|collision|pile-?up|smash)\b/i,
  fire:      /\b(fire|blaze|burn|flames?)\b/i,
  flood:     /\b(flood|flooding|overflow|submerged)\b/i,
  protest:   /\b(protest|demonstration|rally|march|riot)\b/i,
  crime:     /\b(robbery|theft|murder|shooting|stabbing|attack|assault)\b/i,
  killed:    /\b(killed?|dead|death|fatal|fatalities|died?)\b/i,
  injured:   /\b(injure[sd]?|hurt|wounded?|hospitali[sz]ed?|casualties)\b/i,
  arrested:  /\b(arrest(?:ed)?|detained?|custody|charged?)\b/i,
  location:  /\b(junction|intersection|highway|motorway|road|street|avenue|bridge|downtown|city\s*cent(?:re|er)|suburb|district|area|region)\b/i,
  authority: /\b(police|authorities|officials?|government|minister|mayor|spokesperson|fire\s*brigade|ambulance)\b/i,
  vehicle:   /\b(car|truck|lorry|bus|van|motorcycle|vehicle|train)\b/i,
  weather:   /\b(storm|typhoon|earthquake|flood|snow|rain|wind|hurricane|tornado)\b/i,
}

function parseKeywords(raw) {
  const kws = raw.split(/[,\n]+/).map(k => k.trim().toLowerCase()).filter(Boolean)
  const joined = kws.join(' ')

  const flags = {}
  for (const [cat, re] of Object.entries(CATEGORIES)) {
    flags[cat] = re.test(joined)
  }

  // extract number (digit or word)
  let number = null
  const digitMatch = joined.match(/\b(\d+)\b/)
  if (digitMatch) {
    number = parseInt(digitMatch[1], 10)
  } else {
    for (const [word, val] of Object.entries(WORD_NUMBERS)) {
      if (new RegExp(`\\b${word}\\b`).test(joined)) { number = val; break }
    }
  }

  // extract a location phrase (first match)
  let location = 'a busy area'
  const locMatch = joined.match(/\b([\w\s]*(junction|intersection|road|street|bridge|downtown|highway|motorway|district|area|suburb|city cent(?:re|er))[\w\s]*)\b/i)
  if (locMatch) location = locMatch[1].trim()

  // extract vehicle type
  let vehicle = 'vehicle'
  const vehMatch = joined.match(/\b(car|truck|lorry|bus|van|motorcycle|train)\b/i)
  if (vehMatch) vehicle = vehMatch[1].toLowerCase()

  // collect raw keywords for fallback display
  const topics = kws.filter(k => k.length > 2)

  return { flags, number, location, vehicle, topics, raw: joined }
}

// ── Number → word ─────────────────────────────────────────────────────────────

function numWord(n) {
  const words = ['zero','one','two','three','four','five','six','seven','eight','nine','ten']
  return (n != null && n <= 10) ? words[n] : (n != null ? String(n) : null)
}

function numStr(n, word = 'person', plural = 'people') {
  if (n == null) return `several ${plural}`
  return `${numWord(n)} ${n === 1 ? word : plural}`
}

// ── Template engine ───────────────────────────────────────────────────────────

function buildSentences(p) {
  const { flags, number, location, vehicle } = p

  // ── ACCIDENT / CRASH ──────────────────────────────────────────────────────
  if (flags.accident) {
    const s1 = flags.killed
      ? `A serious ${vehicle} accident has left ${numStr(number)} dead.`
      : flags.injured
        ? `A ${vehicle} crash has left ${numStr(number)} injured.`
        : `A serious ${vehicle} accident has been reported.`

    const s2 = `The incident occurred at ${location} earlier today.`

    const s3 = flags.killed && flags.injured
      ? `${numStr(number)} ${number === 1 ? 'person was' : 'people were'} killed, and several others were taken to hospital with injuries.`
      : flags.killed
        ? `Emergency services confirmed fatalities at the scene.`
        : flags.injured
          ? `The injured were transported to a nearby hospital for treatment.`
          : `Emergency services responded quickly to the scene.`

    const s4 = flags.authority
      ? `Police are currently investigating the cause of the accident, and the road has been temporarily closed.`
      : `Authorities are investigating the incident and urging the public to avoid the area.`

    return { s1, s2, s3, s4 }
  }

  // ── FIRE ──────────────────────────────────────────────────────────────────
  if (flags.fire) {
    const s1 = `A major fire broke out in ${location} earlier today.`
    const s2 = flags.killed
      ? `The blaze has claimed the lives of ${numStr(number)}.`
      : flags.injured
        ? `${numStr(number, 'person', 'people')} ${number === 1 ? 'was' : 'were'} injured in the incident.`
        : `Firefighters arrived quickly to contain the blaze.`
    const s3 = `Local residents were evacuated from the surrounding area as a precaution.`
    const s4 = `Fire brigade officials are investigating the cause of the fire, and a full report is expected soon.`
    return { s1, s2, s3, s4 }
  }

  // ── FLOOD ─────────────────────────────────────────────────────────────────
  if (flags.flood) {
    const s1 = `Severe flooding has affected ${location}, causing widespread disruption.`
    const s2 = flags.injured
      ? `${numStr(number)} were injured and required emergency assistance.`
      : `Several roads and homes have been submerged by rising water levels.`
    const s3 = `Residents in low-lying areas have been asked to evacuate as a precaution.`
    const s4 = `Government officials have declared an emergency and are coordinating relief efforts.`
    return { s1, s2, s3, s4 }
  }

  // ── PROTEST ──────────────────────────────────────────────────────────────
  if (flags.protest) {
    const s1 = `A large demonstration took place in ${location} earlier today.`
    const s2 = number
      ? `Approximately ${numStr(number, 'person', 'people')} gathered to voice their concerns.`
      : `Hundreds of people gathered in the area to voice their concerns.`
    const s3 = flags.arrested
      ? `Police confirmed that several individuals were arrested during the event.`
      : `The protest remained largely peaceful, with a strong police presence throughout.`
    const s4 = `City officials have called for calm and pledged to address the demonstrators' concerns.`
    return { s1, s2, s3, s4 }
  }

  // ── CRIME ─────────────────────────────────────────────────────────────────
  if (flags.crime) {
    const s1 = `A serious incident has been reported in ${location}.`
    const s2 = flags.arrested
      ? `Police have confirmed that a suspect has been detained in connection with the incident.`
      : `Police are currently searching for a suspect following the incident.`
    const s3 = flags.injured
      ? `${numStr(number)} ${number === 1 ? 'person was' : 'people were'} treated for injuries at the scene.`
      : `Investigators have sealed off the area and are collecting evidence.`
    const s4 = `Authorities are urging anyone with information to come forward and contact local police.`
    return { s1, s2, s3, s4 }
  }

  // ── GENERIC FALLBACK ──────────────────────────────────────────────────────
  const topicStr = p.topics.slice(0, 3).join(', ') || 'a developing situation'
  const s1 = `A significant incident involving ${topicStr} has been reported.`
  const s2 = `The situation is developing in ${location}.`
  const s3 = flags.injured
    ? `${numStr(number)} ${number === 1 ? 'person was' : 'people were'} affected and received medical attention.`
    : `Local authorities have been notified and are monitoring the situation closely.`
  const s4 = `Officials have called for calm and promised to release further information as it becomes available.`
  return { s1, s2, s3, s4 }
}

function buildHeadline(p) {
  const { flags, number, location, vehicle } = p
  const loc = location !== 'a busy area' ? ` at ${titleCase(location)}` : ''
  const n = number ? `${titleCase(numWord(number))} ` : ''

  if (flags.accident && flags.killed) return `${n}${number === 1 ? 'Person' : 'People'} Killed in ${titleCase(vehicle)} Crash${loc}`
  if (flags.accident && flags.injured) return `${n}${number === 1 ? 'Person' : 'People'} Injured in ${titleCase(vehicle)} Accident${loc}`
  if (flags.accident) return `Serious ${titleCase(vehicle)} Crash Reported${loc}`
  if (flags.fire && flags.killed) return `${n}${number === 1 ? 'Person' : 'People'} Dead in Major Fire${loc}`
  if (flags.fire) return `Major Fire Breaks Out${loc}`
  if (flags.flood) return `Flooding Causes Disruption${loc}`
  if (flags.protest && flags.arrested) return `Arrests Made as Protesters Gather${loc}`
  if (flags.protest) return `Large Demonstration Held${loc}`
  if (flags.crime && flags.arrested) return `Suspect Arrested Following Incident${loc}`
  if (flags.crime) return `Police Respond to Serious Incident${loc}`
  const t = p.topics[0] || 'developing story'
  return titleCase(t) + ' — Developing Story'
}

function titleCase(str) {
  return str.replace(/\b\w/g, c => c.toUpperCase())
}

// ── Script builder ────────────────────────────────────────────────────────────

function buildScript(keywords, studentName) {
  const name = studentName.trim() || 'Your Name'
  const parsed = parseKeywords(keywords)
  const { s1, s2, s3, s4 } = buildSentences(parsed)
  const headline = buildHeadline(parsed)

  return {
    opening:  `This is MPG Radio News Station.\nI'm ${name}.`,
    topStory: `Today's top story: ${headline}.`,
    mainNews: `${s1} ${s2} ${s3} ${s4}`,
    closing:  `That's all for today's news.\nThank you for tuning in to MPG Radio.`,
  }
}

function scriptToText(s) {
  return `${s.opening}\n\n${s.topStory}\n\n${s.mainNews}\n\n${s.closing}`
}

// ── Chunk extractor ───────────────────────────────────────────────────────────

const HARD_WORDS = [
  'investigating','authorities','correspondent','according','broadcast',
  'residents','ambulance','parliament','legislation','confirmed',
  'infrastructure','collision','casualties','emergency','community',
  'announced','approximately','representative','administration',
  'devastation','unprecedented','spokesperson','monitoring',
  'evacuated','submerged','demonstration','temporarily','precaution',
]

// phrases always worth practising regardless of script content
const FIXED_CHUNKS = [
  "emergency services responded",
  "authorities are investigating",
  "that's all for today's news",
]

function extractChunks(scriptText) {
  const found = new Set()
  const lower = scriptText.toLowerCase()

  HARD_WORDS.forEach(w => { if (lower.includes(w)) found.add(w) })

  // extract verb-phrase chunks from the generated text itself
  const phraseRe = /\b(\w+ (?:were|was|has been|have been|are being) \w+(?:\s\w+)?)\b/gi
  let m
  while ((m = phraseRe.exec(scriptText)) !== null) {
    const p = m[0].toLowerCase()
    if (p.length > 10 && p.length < 42) found.add(p)
  }

  FIXED_CHUNKS.forEach(p => found.add(p))

  return [...found].slice(0, 12)
}

// ── Chunk Card ────────────────────────────────────────────────────────────────

function ChunkCard({ text, voice }) {
  const [recUrl, setRecUrl]     = useState(null)
  const [recording, setRecording] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const mrRef    = useRef(null)
  const audioRef = useRef(null)

  async function speak() {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    setSpeaking(true)
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, accent: voice.accent, gender: voice.gender, speed: voice.speed }),
      })
      if (!res.ok) throw new Error('TTS failed')
      const audio = new Audio(URL.createObjectURL(await res.blob()))
      audioRef.current = audio
      audio.onended = () => { audioRef.current = null; setSpeaking(false) }
      audio.play()
    } catch {
      setSpeaking(false)
    }
  }

  async function startRec() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mr = new MediaRecorder(stream)
    const chunks = []
    mr.ondataavailable = e => chunks.push(e.data)
    mr.onstop = () => {
      stream.getTracks().forEach(t => t.stop())
      setRecUrl(URL.createObjectURL(new Blob(chunks, { type: 'audio/webm' })))
    }
    mrRef.current = mr
    mr.start()
    setRecording(true)
  }

  function stopRec() { mrRef.current?.stop(); setRecording(false) }

  return (
    <div className="chunk-card">
      <div className="chunk-text">{text}</div>
      <div className="chunk-btns">
        <button className="btn-sm" onClick={speak} disabled={speaking}>
          {speaking ? '⏳' : '▶ Listen'}
        </button>
        {recording
          ? <button className="btn-sm btn-rec-on" onClick={stopRec}>⏹ Stop</button>
          : <button className="btn-sm" onClick={startRec}>● Record</button>
        }
      </div>
      {recUrl && <audio src={recUrl} controls className="mini-audio" />}
    </div>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [studentName, setStudentName] = useState('')
  const [studentId, setStudentId]   = useState('')
  const [keywords, setKeywords]     = useState('')
  const [script, setScript]         = useState(null)
  const [chunks, setChunks]         = useState([])
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError]     = useState(null)

  const [ttsVoice, setTtsVoice]       = useState({ gender: 'male', accent: 'american', speed: 1.0 })
  const [ttsPlaying, setTtsPlaying]   = useState(false)
  const [chunksExpanded, setChunksExpanded] = useState(true)

  const [isRecording, setIsRecording] = useState(false)
  const ttsAudioRef = useRef(null)

  // ── generate script (AI) ──
  async function generate() {
    if (!keywords.trim()) return
    setGenerating(true)
    setGenError(null)
    try {
      const res = await fetch('/api/generate-news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentName, studentId, keywords }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Server error ${res.status}`)
      setScript({
        opening:  data.opening,
        topStory: data.topStory,
        mainNews: data.mainNews,
        closing:  data.closing,
      })
      setChunks(Array.isArray(data.chunks) && data.chunks.length > 0
        ? data.chunks
        : extractChunks(`${data.mainNews} ${data.topStory}`)
      )
      setChunksExpanded(true)
    } catch (err) {
      setGenError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  // ── TTS (Azure) ──
  async function speakFull() {
    if (!script) return
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause()
      ttsAudioRef.current = null
    }
    setTtsPlaying(true)
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text:   scriptToText(script),
          accent: ttsVoice.accent,
          gender: ttsVoice.gender,
          speed:  ttsVoice.speed,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || `TTS error ${res.status}`)
      }
      const blob  = await res.blob()
      const url   = URL.createObjectURL(blob)
      const audio = new Audio(url)
      ttsAudioRef.current = audio
      audio.onended = () => { ttsAudioRef.current = null; setTtsPlaying(false) }
      audio.play()
    } catch (err) {
      console.error('TTS error:', err)
      setTtsPlaying(false)
    }
  }
  function stopTts() {
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause()
      ttsAudioRef.current = null
    }
    setTtsPlaying(false)
  }

  const onAir = isRecording

  return (
    <div className="app">

      {/* ── Header ── */}
      <header className="header">
        <div className={`on-air ${onAir ? 'on-air--active' : ''}`}>
          <span className="on-air-dot" />
          ON AIR
        </div>
        <div className="header-center">
          <h1 className="site-title">🎙 MPG RADIO NEWS STATION</h1>
          <p className="site-sub">On Air: Student Broadcaster</p>
          <p className="site-credit">Produced by Hitoshi Eguchi</p>
        </div>
        <div style={{ width: 90 }} />
      </header>

      <main className="main">

        {/* ══ 1. NEWS MAKING ══════════════════════════════════════════════════ */}
        <section className="card">
          <h2 className="stage-heading"><span className="stage-pill">1</span>News Making</h2>

          <div className="field-row">
            <input className="field" placeholder="Your name (e.g. Taro Yamada)"
              value={studentName} onChange={e => setStudentName(e.target.value)} />
            <input className="field" placeholder="Student ID (e.g. 2026001)"
              value={studentId} onChange={e => setStudentId(e.target.value)} />
          </div>

          <textarea className="field textarea" rows={4}
            placeholder="Enter keywords, one per line or comma-separated&#10;e.g. fire in downtown, two people injured, firefighters, investigating"
            value={keywords} onChange={e => setKeywords(e.target.value)} />

          <button className="btn-primary" onClick={generate} disabled={generating}>
            {generating ? '⏳ Generating…' : '📰 Generate News Script'}
          </button>

          {genError && (
            <div className="gen-error">
              ⚠ {genError}
            </div>
          )}

          {script && (
            <div className="script-card">
              <div className="script-body">
                <div className="script-block">
                  <div className="script-label">OPENING</div>
                  <p className="script-text">{script.opening}</p>
                </div>
                <hr className="script-rule" />
                <div className="script-block">
                  <div className="script-label">TOP STORY</div>
                  <p className="script-text">{script.topStory}</p>
                </div>
                <hr className="script-rule" />
                <div className="script-block">
                  <div className="script-label">MAIN NEWS</div>
                  <p className="script-text">{script.mainNews}</p>
                </div>
                <hr className="script-rule" />
                <div className="script-block">
                  <div className="script-label">CLOSING</div>
                  <p className="script-text">{script.closing}</p>
                </div>
              </div>
              <div className="script-footer-bar">
                MPG Radio News Station — Produced by Hitoshi Eguchi
              </div>
            </div>
          )}
        </section>

        {/* ══ 2. RECORD BROADCAST ═════════════════════════════════════════════ */}
        {script && (
          <section className="card">
            <h2 className="stage-heading"><span className="stage-pill">2</span>Record Broadcast</h2>
            <SimpleRecorder
              studentId={studentId}
              studentName={studentName}
              onRecordingChange={setIsRecording}
            />
          </section>
        )}

        {/* ══ 3. TTS PRACTICE ═════════════════════════════════════════════════ */}
        {script && (
          <section className="card">
            <h2 className="stage-heading"><span className="stage-pill">3</span>TTS Practice</h2>
            <div className="controls-row">
              <label className="ctrl-label">Voice
                <select className="select" value={ttsVoice.gender}
                  onChange={e => setTtsVoice(v => ({ ...v, gender: e.target.value }))}>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </label>
              <label className="ctrl-label">Accent
                <select className="select" value={ttsVoice.accent}
                  onChange={e => setTtsVoice(v => ({ ...v, accent: e.target.value }))}>
                  <option value="american">American</option>
                  <option value="british">British</option>
                </select>
              </label>
              <label className="ctrl-label">Speed
                <select className="select" value={ttsVoice.speed}
                  onChange={e => setTtsVoice(v => ({ ...v, speed: parseFloat(e.target.value) }))}>
                  <option value={0.8}>0.8×</option>
                  <option value={1.0}>1.0×</option>
                  <option value={1.2}>1.2×</option>
                </select>
              </label>
            </div>
            {ttsPlaying
              ? <button className="btn-secondary" onClick={stopTts}>⏹ Stop</button>
              : <button className="btn-secondary" onClick={speakFull}>▶ Listen to Full Script</button>
            }
          </section>
        )}

        {/* ══ 4. CHUNK PRACTICE ═══════════════════════════════════════════════ */}
        {script && chunks.length > 0 && (
          <section className="card">
            <h2 className="stage-heading">
              <span className="stage-pill">4</span>Chunk Practice
              <button className="btn-chunk-toggle" onClick={() => setChunksExpanded(v => !v)}>
                {chunksExpanded ? 'Hide Chunk Practice ▲' : 'Show Chunk Practice ▼'}
              </button>
            </h2>
            {chunksExpanded ? (
              <>
                <p className="hint">Practice these difficult words and phrases. Listen, then record yourself.</p>
                <div className="chunks-grid">
                  {chunks.map((c, i) => <ChunkCard key={i} text={c} voice={ttsVoice} />)}
                </div>
              </>
            ) : (
              <p className="hint">Practice these chunks before recording. Click Show to review them again.</p>
            )}
          </section>
        )}

      </main>

      <footer className="footer">
        <p>Developed by Hitoshi Eguchi</p>
        <p>Hokusei Gakuen University</p>
      </footer>
    </div>
  )
}
