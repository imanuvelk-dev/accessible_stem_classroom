# Accessible STEM Classroom — Final-Year Project MVP

A Google Meet-style video classroom focused on accessible STEM education:
- LiveKit-powered video/audio rooms
- Browser live captions (Chrome/Edge Web Speech API)
- Context-aware STEM term normalization through FastAPI
- Live in-room text chat
- Student-to-teacher text messages
- Shared drawing canvas for equations/diagrams
- Sign-language bridge UI with camera preview, ISL/ASL selector, direction selector, and manual verified-gloss delivery test
- Caption controls: font size, high contrast, pause/resume
- Optional Supabase database schema for persistent meeting/message records

> This is an educational MVP, not a production-ready medical/accessibility or enterprise conferencing system.
> The live captions use the browser Web Speech API for a quick local demo. Browser support varies. The backend includes a replaceable context-processing endpoint; it does not claim to be a trained STEM speech model.
> Sign-language translation is not implemented in this starter because reliable sign-language recognition requires a defined sign language, dataset, and evaluation. The student interface includes text and drawing as accessible two-way channels.

## Architecture

- `frontend/`: React + Vite + TypeScript + LiveKit React components
- `backend/`: FastAPI token service and STEM-context endpoint
- `database/schema.sql`: Supabase/PostgreSQL schema

## Prerequisites (Windows)

1. Install Node.js LTS (includes npm).
2. Install Python 3.11 or 3.12.
3. Create a LiveKit project at https://cloud.livekit.io/ and copy its URL, API key, and API secret.
4. Optional: create a Supabase project if you want persistence.

## 1. Configure and run the backend

Open PowerShell in this folder:

```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
Copy-Item .env.example .env
```

Edit `backend/.env` and set your LiveKit credentials. Never put the API secret in frontend environment variables or commit `.env`.

Start the API:

```powershell
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Check `http://127.0.0.1:8000/health` and API docs at `http://127.0.0.1:8000/docs`.

## 2. Configure and run the frontend

Open a second PowerShell terminal:

```powershell
cd frontend
npm install
Copy-Item .env.example .env
```

Edit `frontend/.env`:
- `VITE_API_BASE_URL=http://127.0.0.1:8000`
- `VITE_LIVEKIT_URL=wss://YOUR_PROJECT.livekit.cloud`

Then run:

```powershell
npm run dev
```

Open the local URL printed by Vite (usually `http://localhost:5173`). Use Chrome or Edge for the best Web Speech API support. Enter a display name, select Teacher or Student, and create/join a room. To test with two people, open another browser profile/device and join the same room name.

## 3. Supabase database (optional)

In Supabase SQL Editor, run `database/schema.sql`. Set the backend `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` only if you add the persistence adapter. The starter schema is supplied, but this MVP currently keeps live room state in LiveKit and does not write to Supabase yet.

## Security checklist before public deployment

- Keep `LIVEKIT_API_SECRET` on the backend only.
- Set `ALLOWED_ORIGINS` to your exact frontend origin(s).
- Use HTTPS in production; camera/microphone access requires a secure context except localhost.
- Add real authentication and authorization before exposing the service publicly.
- Add rate limiting, room access rules, abuse reporting, and retention controls.
- Do not store recordings or transcripts without explicit consent.
- The demo role selector is not authentication. Anyone who can reach the demo can choose a role.
- Do not use the development CORS wildcard in production.

## Current MVP limitations

- Caption capture depends on browser speech recognition availability and language settings.
- Captions are generated from the local browser microphone, not automatically from the teacher's LiveKit audio track. For a multi-user production implementation, subscribe to the teacher audio track server-side or use a LiveKit transcription/agent pipeline.
- STEM normalization is a small editable dictionary, not a trained correction model.
- Text chat and canvas are sent over LiveKit data messages; database persistence is not wired in.
- Automatic sign-language recognition is still future work: the UI can preview a camera and send a manually entered verified gloss, but no model currently maps video to signs. A dataset-trained ISL/ASL recognition model and temporal sequence pipeline are required. Teacher-to-student signing output (e.g. sign-language avatar/video) is also not implemented. Meeting recording, calendar scheduling, and production authentication are future work.

## Suggested final-year evaluation

Evaluate with a fixed set of STEM lecture utterances and manually corrected references:
- WER/CER for raw captions vs reference
- STEM term accuracy before/after contextual normalization
- End-to-end caption latency
- User-rated readability (font/contrast/personalization)
- Successful delivery rate for text/drawing messages

Keep raw and processed captions so you can report measured improvements instead of claiming an unverified accuracy score.
