# StudyOS / ContextOS — PRD

## Original problem statement
Behavior-adaptive study OS as a Dynamic Canvas. Round 2: pivot to **Quiet
Luxury / High-End Academic Minimalism** — NO dark mode, NO pure black.
Champagne Cream + Burnt Sienna + Muted Gold, Playfair Display + Instrument
Sans, watercolor topography, wax-seal CTA, Bento dashboard, struggle-sensitive
breathing background, priority engine, premium-paper Flow Frame.

## Architecture
- **Backend**: FastAPI + Motor (async MongoDB), JWT auth (HS256, bcrypt).
  Claude Sonnet 4.5 (`claude-sonnet-4-5-20250929`) via `emergentintegrations.LlmChat`
  + Emergent Universal LLM key. Topics now carry `last_touched_at` (set on
  session start) for the priority engine's TimeDecay term.
- **Frontend**: React 19 + framer-motion + lucide-react. Single-page state
  machine (Auth → BentoDashboard ↔ FlowFrame; SocraticSidekick slide-in
  overlay). `useContextEngine` hook fuses idle / velocity / replays into a
  smoothed CognitiveLoad ∈ [0,1]; isStruggling = load > 0.8 toggles
  `body.classList.struggling` for the global cream→warm-cream morph.
- **MongoDB collections**: `users`, `topics`, `sessions`, `chat_messages`.

## Visual language
- **Background**: #FDFBF7 (Champagne Cream); struggle: #FFF5F0
- **Card**: #F2EDE4 (Soft Linen) + 1px #E5DED0 hairline
- **Accents**: #A35C44 Burnt Sienna (CTAs, struggle ring), #C5A059 Muted Gold
  (rules, Roman pillars, secondary)
- **Type**: Playfair Display (serif), Instrument Sans (UI), Instrument Serif
  (italic body)
- **Signature element**: tactile **wax-seal** button (radial-gradient sienna +
  embossed inner shadow + lift on hover)
- **Mastery topography**: blurred radial-gradient watercolor blobs (sienna
  saturation maps to mastery), italic serif labels — no bars, no harsh edges.

## Core implementations (2026-04-25)
- Auth: `/auth/signup`, `/auth/login`, `/auth/me` (JWT)
- Topics: `/topics` (now with `last_touched_at`)
- Sessions: `/sessions/start` (writes last_touched_at), `/struggle`, `/end`,
  `/sessions`
- Socratic chat: `/chat/socratic`, `/chat/history` — multi-turn Claude 4.5
- `useContextEngine`: idleTime + inputVelocity (chars/s over 6s window) +
  videoReplayCount (`recordReplay()`); manual override window (6s sticky) for
  demo + tests via `setLoadOverride`.
- `priorityEngine.js`: `Priority = MasteryGap*0.5 + TimeDecay*0.3 -
  Confidence*0.2`; HALF_LIFE_DAYS = 7 (saturating exponential decay); untouched
  topics get full decay = 1.
- `BentoDashboard`: Daily Intent hero, wax-seal Next Action card (priority
  engine pick + reason), Mastery Topography watercolor SVG, today/state
  micro-cards, Reading Room (recent sessions), The Stack (priority list).
- `FlowFrame`: scaled-down + fade-out via AnimatePresence; central "premium
  sheet of paper" with serif title + gold rule + italic body, hover
  quick-reference cards on difficult terms, large serif timer, mastery readout,
  notes pad, dev cogload slider, breathing border (sienna→amber on struggle).
- `SocraticSidekick`: editorial column. When struggle is detected (edge), the
  panel **auto-opens** with a Socratic Hint card. Manual chat with Claude 4.5
  with multi-turn history.

## Test status
- Backend: **19/19 pytest** (iteration 3, 100%).
- Frontend: full Playwright flows pass (iteration 2, 98%; UI not retested in
  iter 3 because no UI changes were made).

## Backlog (P1/P2)
- P1: Real automatic struggle detection via signal blending only (already
  works; the dev slider is purely a demo/test affordance — could be hidden
  behind a feature flag for production).
- P1: Gesture-based "circle a region of a diagram" → Hint Bridge popup.
- P2: Streaming Sidekick replies; optimize chat history replay.
- P2: Hydration warning investigation: testing agent flagged a possible
  `<span> in <option>` warning; not reproduced in latest run.
- P2: Split FlowFrame.jsx into smaller components.
- P2: Topographical 3D map upgrade with react-three-fiber (current SVG
  watercolor is on-brand; 3D could be a future Volume II enhancement).

## Next tasks
- Wait for user feedback / new requests.
