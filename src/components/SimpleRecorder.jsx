import { useState, useRef } from 'react'

export default function SimpleRecorder({ studentId, studentName, onRecordingChange }) {
  const [recording, setRecording] = useState(false)
  const [recUrl, setRecUrl]       = useState(null)
  const [recBlob, setRecBlob]     = useState(null)
  const [error, setError]         = useState(null)

  const [playing, setPlaying] = useState(false)

  const mrRef        = useRef(null)
  const streamRef    = useRef(null)
  const chunksRef    = useRef([])
  const playAudioRef = useRef(null)
  const extRef       = useRef('.webm')

  function chooseMime() {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/aac',
      '',
    ]
    return types.find(t => t === '' || MediaRecorder.isTypeSupported(t)) ?? ''
  }

  function mimeToExt(mime) {
    if (mime.startsWith('audio/mp4')) return '.m4a'
    if (mime.startsWith('audio/aac')) return '.aac'
    return '.webm'
  }

  async function start() {
    setError(null)
    setRecUrl(null)
    setRecBlob(null)
    chunksRef.current = []

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const mime = chooseMime()
      const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
      const blobType = mr.mimeType || 'audio/webm'

      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
        const blob = new Blob(chunksRef.current, { type: blobType })
        setRecBlob(blob)
        setRecUrl(URL.createObjectURL(blob))
        extRef.current = mimeToExt(blobType)
      }

      mrRef.current = mr
      mr.start()
      setRecording(true)
      onRecordingChange?.(true)
    } catch (err) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
      setError(
        err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
          ? 'Microphone access was blocked. Please allow microphone access and try again.'
          : `Recording failed: ${err.message}. If recording does not start, please use Chrome or Safari with microphone permission allowed.`
      )
    }
  }

  function stop() {
    try {
      if (mrRef.current && mrRef.current.state !== 'inactive') {
        mrRef.current.stop()
      }
    } catch {
      // ignore stop errors
    }
    setRecording(false)
    onRecordingChange?.(false)
  }

  function playJingle() {
    return new Promise(resolve => {
      const ctx = new AudioContext()
      ctx.resume().then(() => {
        const t0 = ctx.currentTime
        const notes = [
          { freq: 392, start: 0,    dur: 0.22 },
          { freq: 494, start: 0.18, dur: 0.22 },
          { freq: 587, start: 0.36, dur: 0.22 },
          { freq: 784, start: 0.54, dur: 1.1  },
        ]
        notes.forEach(({ freq, start, dur }) => {
          const osc  = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = 'sine'
          osc.frequency.value = freq
          osc.connect(gain)
          gain.connect(ctx.destination)
          gain.gain.setValueAtTime(0, t0 + start)
          gain.gain.linearRampToValueAtTime(0.25, t0 + start + 0.02)
          gain.gain.setValueAtTime(0.25, t0 + start + dur * 0.55)
          gain.gain.linearRampToValueAtTime(0, t0 + start + dur)
          osc.start(t0 + start)
          osc.stop(t0 + start + dur + 0.01)
        })
        setTimeout(() => { ctx.close(); resolve() }, 1800)
      }).catch(resolve)
    })
  }

  async function playRecording() {
    if (playing) {
      if (playAudioRef.current) { playAudioRef.current.pause(); playAudioRef.current = null }
      setPlaying(false)
      return
    }
    setPlaying(true)
    try { await playJingle() } catch { /* jingle failure — continue */ }
    try {
      const audio = new Audio(recUrl)
      playAudioRef.current = audio
      audio.onended = () => { playAudioRef.current = null; setPlaying(false) }
      await audio.play()
    } catch {
      setPlaying(false)
    }
  }

  function download() {
    if (!recBlob || !recUrl) return
    const id   = (studentId   || '').trim() || 'StudentID'
    const name = (studentName || '').trim().replace(/\s+/g, '_') || 'StudentName'
    const a = document.createElement('a')
    a.href = recUrl
    a.download = `${id}_${name}_MPG_NewsRadio${extRef.current}`
    a.click()
  }

  const id   = (studentId   || 'StudentID').trim()
  const name = ((studentName || 'StudentName').trim().replace(/\s+/g, '_'))

  return (
    <div>
      {error && <p className="gen-error">⚠ {error}</p>}

      <div className="rec-row">
        {recording
          ? <button className="btn-stop" onClick={stop}>⏹ Stop Recording</button>
          : <button className="btn-rec"  onClick={start}>⏺ Start Recording</button>
        }
      </div>

      {recUrl && (
        <div className="playback-row">
          <button className="btn-secondary" onClick={playRecording}>
            {playing ? '⏹ Stop' : '▶ Play Recording'}
          </button>
        </div>
      )}

      {recBlob && (
        <div className="submit-section">
          <button className="btn-download" onClick={download}>⬇ Download Recording</button>
          <p className="hint" style={{ marginTop: '0.75rem' }}>
            File: <code>{id}_{name}_MPG_NewsRadio{extRef.current}</code>
          </p>
          <p className="hint">After downloading your file, submit it to the Moodle assignment page.</p>
        </div>
      )}
    </div>
  )
}
