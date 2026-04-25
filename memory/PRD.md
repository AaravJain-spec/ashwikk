# StudyOS / ContextOS — PRD

## Original problem statement
Build a behavior-adaptive study OS with a "Dynamic Canvas" UI that morphs to the
student's cognitive state — three views (Zen Execution Frame, 3D Context Map,
Socratic Sidekick) on an OLED-black canvas with a single signature accent.
User chose: all five (full scope) + "surprise me" on the accent.

## Architecture
- **Backend**: FastAPI + Motor (async MongoDB), JWT auth (HS256, bcrypt), Claude
  Sonnet 4.5 (`claude-sonnet-4-5-20250929`) via `emergentintegrations.LlmChat` +
  Emergent Universal LLM key.
- **Frontend**: React 19 + framer-motion (single-page Dynamic Canvas state
  machine: auth → ContextMap ↔ ZenFrame; SocraticSidekick slides in over Zen).
- **MongoDB collections**: `users`, `topics`, `sessions`, `chat_messages`.
- **Design**: OLED black (#000) + Glacial Cyan (#00F0FF) primary + Warm Amber
  (#FF9500) struggle. Fonts: Clash Display / Manrope / JetBrains Mono.

## Core requirements (static)
- JWT auth (signup/login/me).
- Auto-seed 10 default topics with x/y coordinates + mastery on first login.
- Sessions with timer, struggle score, mastery_delta on completion.
- Socratic AI chat (multi-turn, persistent history).
- Topographical map: peaks (mastery>50) + valleys (<=50) + glowing "Next Path"
  through the 5 weakest topics.
- Zen Frame: glassmorphic card, breathing border (cyan→amber when struggle>60),
  hoverable difficult terms with quick-reference popovers, ghost-text nudges.

## What's been implemented (2026-04-25)
- Full backend (`/app/backend/server.py`) — all endpoints listed below.
- Full frontend: `AuthScreen`, `ContextMap` (SVG topographical), `ZenFrame`
  (glassmorphic + breathing pulse + HUD + quick-refs + ghost nudges),
  `SocraticSidekick` (slide-in chat panel with multi-turn history).
- Real Claude Sonnet 4.5 wired in for the Sidekick.
- Idempotent default-topic seeding for new users.
- Tested end-to-end by testing agent — **18/18 backend tests pass, all
  frontend Playwright flows pass, zero bugs**.

## API surface
- `POST /api/auth/signup` `{email, password, name}` → `{token, user}`
- `POST /api/auth/login` `{email, password}` → `{token, user}`
- `GET  /api/auth/me`
- `GET  /api/topics`
- `POST /api/sessions/start` `{topic_id, duration_minutes}`
- `POST /api/sessions/{id}/struggle` `{struggle_score}`
- `POST /api/sessions/{id}/end` `{mastery_delta}`
- `GET  /api/sessions`
- `POST /api/chat/socratic` `{session_id, text, struggle_score}`
- `GET  /api/chat/history?session_id=`

## Backlog (P1/P2)
- P1: Real R3F 3D map (currently SVG topographical — looks great but is 2D).
- P1: Automatic struggle detection (typing pauses, scroll thrash, time-on-term)
  instead of the current manual slider proxy.
- P1: "Gesture-Based Queries" — drag-to-circle a region and feed it to Claude.
- P2: Streaming responses for the Sidekick (currently waits for full reply).
- P2: Optimize chat replay — current implementation re-sends history each call.
- P2: Differentiate "exit without grading" vs "fail" instead of always
  applying `mastery_delta = -1` on exit.
- P2: Split `ZenFrame.jsx` (~415 lines) into smaller composed pieces.

## Next tasks
- Wait for user feedback / new requests.
