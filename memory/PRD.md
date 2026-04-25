# StudyOS — AI Study Agent · PRD

## Original problem statement
Build StudyOS as an autonomous AI study agent that **decides what to study,
runs the session, detects struggle, and adapts dynamically** — not a
dashboard, not a planner. ONE SCREEN = ONE ACTION. Five engines: Context,
Decision, Execution, Struggle Detection, Prediction. Plus syllabus upload +
country/class onboarding with national-curriculum fallback (CBSE NCERT for
India, etc.).

## Architecture
- **Backend**: FastAPI + Motor (MongoDB), JWT auth, Claude Sonnet 4.5
  (`claude-sonnet-4-5-20250929`) via `emergentintegrations.LlmChat` + Emergent
  Universal LLM key.
- **Frontend**: React 19 + framer-motion + lucide-react. Single-page state
  machine: auth → onboarding → hero ↔ active ↔ insights, with a Sidekick
  slide-in overlay.
- **Engines**:
  - **Context Engine** (frontend `useContextEngine`): idleTime + inputVelocity
    + videoReplayCount → CognitiveLoad ∈ [0,1]; isStruggling = load > 0.8.
  - **Decision Engine** (frontend `priorityEngine`): `priority = MasteryGap*0.5
    + TimeDecay*0.3 - Confidence*0.2`; weakest topic surfaces as Next Move.
  - **Execution Engine** (backend `/sessions/{id}/question` + `/answer`):
    Claude generates an exam-style question; Claude evaluates the answer with
    {correct, score, feedback}; auto-difficulty (medium → escalates after 2
    correct; → easy after 2 wrong; or forced easy via `easier:true`).
  - **Struggle Detection**: 3 wrong in a row OR struggle_score > 80 →
    `should_interrupt=true` + StruggleModal in UI offering "Try easier" or
    "Solve 2 quick questions" or "Push through".
  - **Prediction Engine** (backend `/insights`): rule-based weak topics +
    patterns ("avoids difficult topics", "wrong-answer cascades") + per-topic
    marks-loss range.

## Visual language (Quiet Luxury)
- Background **#FDFBF7** (Champagne Cream); struggle morph **#FFF5F0**
- Cards **#F2EDE4** (Soft Linen) + 1px **#E5DED0** hairline
- Accents **#A35C44** (Burnt Sienna) for CTAs/struggle, **#C5A059** (Muted
  Gold) for rules/secondary
- Type: Playfair Display (display) + Instrument Sans (UI) + Instrument Serif
  (italic body)
- Signature: tactile **wax-seal** button (radial-gradient sienna + embossed
  shadow + lift on hover)

## API surface
**Auth & profile**: `/auth/signup` `/auth/login` `/auth/me` `/profile` (PUT)

**Syllabus**: `/syllabus/options` · `/syllabus/national` (preview) ·
`/syllabus/apply-national` · `/syllabus/upload` (PDF/text/paste) ·
`/syllabus/skip` (defaults)

**Topics & sessions**: `/topics` · `/sessions/start` · `/sessions/{id}/struggle`
· `/sessions/{id}/end` · `/sessions`

**Q&A engine**: `POST /sessions/{id}/question` (auto-difficulty + `easier:bool`)
· `POST /sessions/{id}/answer` (returns correctness + streak + interrupt
signal + insight) · `POST /sessions/{id}/event` (logs behavior)

**Sidekick**: `/chat/socratic` · `/chat/history`

**Insights**: `GET /insights` (weak_topics, patterns, predictions, totals)

## What's been implemented (2026-04-25)
- Auth + JWT, onboarding (5 countries × multiple classes), syllabus upload via
  Claude parsing, Q&A engine with real Claude evaluation, struggle interrupt,
  insights with marks-loss predictions, Sidekick chat, breathing background,
  wax-seal aesthetics throughout.
- **Tested**: **40/40 backend pytest pass** (8 Q&A engine + 19 studyos + 13
  syllabus); full frontend happy path verified end-to-end with Playwright.

## Backlog (P1/P2)
- P1: Real automatic struggle detection from text-input pauses (already works
  via useContextEngine; the dev cogload slider could be hidden behind a flag).
- P1: Wire `recordReplay` into the active-session ghost UI for content video
  re-watches when video material is added.
- P1: Surface Claude-generated explanation links from feedback into a
  one-click "explain this" sidekick prompt.
- P2: Streaming Claude responses for the Sidekick + question generation.
- P2: PDF generation of an end-of-session "passage" recap (export as PNG/PDF).
- P2: Spaced-repetition scheduler that schedules tomorrow's first move.
- P2: A real 3D map upgrade for the topography view (Volume II).

## Next tasks
- Wait for user feedback / new requests.
