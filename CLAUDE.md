# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # start both Vite (UI) + Express API server concurrently
npm run dev:ui   # Vite only (port auto-selected, usually 5173/5174)
npm run dev:api  # Express API server only (port 3001)
npm run build    # production build → dist/
npm run preview  # serve the production build locally
```

## Environment setup

Copy `.env.example` to `.env` and add your OpenAI key:
```
OPENAI_API_KEY=sk-...
```

## Architecture

Single-page React + Vite app (`src/App.jsx`) with one serverless API route.

### Files

| File | Purpose |
|------|---------|
| `src/App.jsx` | All React components and state |
| `api/generate-news.js` | Vercel serverless function — calls OpenAI, returns structured script |
| `dev-server.js` | Local Express wrapper around the serverless function for development |
| `vite.config.js` | Proxies `/api/*` to `localhost:3001` during dev |

### React components

| Component | Purpose |
|-----------|---------|
| `App` | Root — holds all state, renders all five stages sequentially |
| `VolumeMeter` | Web Audio API real-time level bar (getUserMedia → AudioContext → AnalyserNode → canvas) |
| `ChunkCard` | Per-word/phrase card: TTS listen + MediaRecorder self-recording |

### Data flow

1. User enters keywords → frontend POSTs to `/api/generate-news`.
2. API calls OpenAI (`gpt-4o-mini`, `response_format: json_object`) with a strict system prompt that enforces CEFR B1–B2 broadcast English and returns `{ headline, mainNews, chunks }`.
3. API assembles the full script object (`opening`, `topStory`, `mainNews`, `closing`) and returns it with `chunks`.
4. `extractChunks()` in the frontend is kept as a fallback if the API returns empty chunks.
5. TTS uses `window.speechSynthesis` — `applyVoice()` filters available voices by lang + name pattern for gender/accent.
6. Recording uses `MediaRecorder` on the same mic stream that feeds `VolumeMeter`. Stream obtained once via `getMic()` and reused.
7. Pink-noise ambience is generated via `AudioContext` buffer on mount, toggled by adjusting a `GainNode`.
8. Download uses a blob URL + `<a download>` — no server needed.

### Deployment (Vercel)

- Set `OPENAI_API_KEY` in Vercel project environment variables.
- `api/generate-news.js` is picked up automatically as a serverless function.
- `dev-server.js` and `express`/`dotenv` are dev-only and not deployed.

### Key design decisions

- The meter canvas is sized at 520×32 in JSX but `width:100%` in CSS — logical pixel size is fixed; CSS scales it visually.
- `MediaRecorder` outputs `audio/webm` (browser default). The download filename uses `.webm` to match.
- `speechSynthesis.getVoices()` is called at speak-time (not on mount) because voices load asynchronously on some browsers.
- Ambience `AudioContext` is created on mount inside a `useEffect` to comply with browser autoplay rules (starts muted at gain=0).
- The OpenAI call uses `temperature: 0.7` — low enough for consistent structure, high enough for natural variation.
