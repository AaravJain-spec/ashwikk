"""StudyOS / ContextOS backend.

Behavior-Adaptive study OS:
- JWT auth (signup / login / me)
- Topics with mastery scores (auto-seeded on first login)
- Study sessions with struggle detection
- Socratic Sidekick AI chat (Claude Sonnet 4.5 via emergentintegrations)
"""
from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Optional

import bcrypt
import jwt
from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage
from fastapi import (
    APIRouter, Depends, FastAPI, File, Form, HTTPException, UploadFile, status,
)
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from starlette.middleware.cors import CORSMiddleware

from national_syllabi import NATIONAL_SYLLABI, get_syllabus, list_countries

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# ─── infra ──────────────────────────────────────────────────────────────────
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGO = "HS256"
JWT_TTL_HOURS = 24 * 7

EMERGENT_LLM_KEY = os.environ["EMERGENT_LLM_KEY"]

app = FastAPI(title="StudyOS / ContextOS")
api = APIRouter(prefix="/api")
bearer_scheme = HTTPBearer(auto_error=False)

# ─── default topic seed ─────────────────────────────────────────────────────
DEFAULT_TOPICS = [
    {"name": "Linear Algebra", "domain": "Mathematics", "mastery": 72, "x": 0.18, "y": 0.28},
    {"name": "Real Analysis", "domain": "Mathematics", "mastery": 34, "x": 0.32, "y": 0.62},
    {"name": "Probability", "domain": "Mathematics", "mastery": 58, "x": 0.50, "y": 0.34},
    {"name": "Differential Eqs", "domain": "Mathematics", "mastery": 22, "x": 0.66, "y": 0.70},
    {"name": "Quantum Mechanics", "domain": "Physics", "mastery": 18, "x": 0.82, "y": 0.40},
    {"name": "Thermodynamics", "domain": "Physics", "mastery": 64, "x": 0.74, "y": 0.18},
    {"name": "Organic Chemistry", "domain": "Chemistry", "mastery": 41, "x": 0.46, "y": 0.78},
    {"name": "Cell Biology", "domain": "Biology", "mastery": 80, "x": 0.22, "y": 0.80},
    {"name": "Algorithms", "domain": "Computer Science", "mastery": 88, "x": 0.10, "y": 0.50},
    {"name": "Compilers", "domain": "Computer Science", "mastery": 30, "x": 0.90, "y": 0.74},
]

SOCRATIC_SYSTEM = (
    "You are the Socratic Sidekick inside StudyOS — a calm, precise, slightly otherworldly "
    "study companion. Never lecture. Reply in 1–3 short sentences. Ask probing questions, "
    "offer angles, and surface intuitions instead of full answers. If the student seems stuck "
    "(struggle_score is high), provide one concrete next step. Avoid emoji. Use lowercase "
    "punctuation when natural. Keep tone neuro-tech instrument: signal, not noise."
)

# ─── models ─────────────────────────────────────────────────────────────────
class SignupIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    name: str = Field(min_length=1, max_length=64)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    token: str
    user: "UserOut"


class UserOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: EmailStr
    name: str
    country: Optional[str] = None
    class_level: Optional[str] = None
    syllabus_source: Optional[str] = None  # "national" | "uploaded" | None
    syllabus_name: Optional[str] = None    # e.g. "CBSE NCERT" or filename
    onboarded: bool = False


class Topic(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    domain: str
    mastery: int
    x: float
    y: float
    last_touched_at: Optional[str] = None


class StartSessionIn(BaseModel):
    topic_id: str
    duration_minutes: int = Field(default=25, ge=5, le=180)


class Session(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    topic_id: str
    topic_name: str
    duration_minutes: int
    started_at: str
    ended_at: Optional[str] = None
    struggle_score: int = 0
    mastery_delta: int = 0


class StruggleIn(BaseModel):
    struggle_score: int = Field(ge=0, le=100)


class EndSessionIn(BaseModel):
    mastery_delta: int = Field(default=4, ge=-20, le=20)


class ChatIn(BaseModel):
    session_id: str
    text: str
    struggle_score: int = 0


class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    session_id: str
    role: str  # "user" | "assistant"
    text: str
    created_at: str


# ─── auth helpers ───────────────────────────────────────────────────────────
def _hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def _verify_pw(pw: str, hashed: str) -> bool:
    return bcrypt.checkpw(pw.encode(), hashed.encode())


def _make_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_TTL_HOURS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


async def current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> dict:
    if not creds or not creds.credentials:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "missing token")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "user not found")
    return user


async def _seed_topics_for(user_id: str) -> None:
    existing = await db.topics.count_documents({"user_id": user_id})
    if existing:
        return
    docs = []
    for t in DEFAULT_TOPICS:
        docs.append({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "name": t["name"],
            "domain": t["domain"],
            "mastery": t["mastery"],
            "x": t["x"],
            "y": t["y"],
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    await db.topics.insert_many(docs)


def _user_to_out(user: dict) -> "UserOut":
    return UserOut(
        id=user["id"],
        email=user["email"],
        name=user["name"],
        country=user.get("country"),
        class_level=user.get("class_level"),
        syllabus_source=user.get("syllabus_source"),
        syllabus_name=user.get("syllabus_name"),
        onboarded=bool(user.get("onboarded", False)),
    )


def _layout_topics(subjects: dict) -> list[dict]:
    """Lay out subject→[topics] dict as bands of nodes on the topography map.

    Each subject is one horizontal band. Topics spread evenly along x within
    the band. Returns list of {name, domain, mastery, x, y}.
    """
    out: list[dict] = []
    subject_keys = list(subjects.keys())
    n_bands = max(1, len(subject_keys))
    for bi, subj in enumerate(subject_keys):
        # band y in (0.12 .. 0.92) with vertical jitter
        y_base = 0.12 + (bi + 0.5) / n_bands * 0.8
        topics = subjects[subj]
        n = max(1, len(topics))
        for ti, topic_name in enumerate(topics):
            x = 0.06 + (ti + 0.5) / n * 0.88
            jitter = 0.04 * ((bi + ti) % 3 - 1)
            out.append({
                "name": str(topic_name).strip(),
                "domain": subj,
                "mastery": 25,  # everyone starts at low mastery on a fresh syllabus
                "x": round(max(0.02, min(0.98, x)), 3),
                "y": round(max(0.05, min(0.95, y_base + jitter)), 3),
            })
    return out


async def _apply_syllabus_for_user(
    user_id: str,
    subjects: dict,
    source: str,
    name: str,
    country: Optional[str] = None,
    class_level: Optional[str] = None,
) -> int:
    """Replace user's topics with the given syllabus subjects→topics map.

    Returns count of topics inserted.
    """
    # wipe existing
    await db.topics.delete_many({"user_id": user_id})

    laid = _layout_topics(subjects)
    docs = []
    for t in laid:
        docs.append({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "name": t["name"],
            "domain": t["domain"],
            "mastery": t["mastery"],
            "x": t["x"],
            "y": t["y"],
            "last_touched_at": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    if docs:
        await db.topics.insert_many(docs)

    update: dict = {
        "syllabus_source": source,
        "syllabus_name": name,
        "onboarded": True,
    }
    if country:
        update["country"] = country
    if class_level:
        update["class_level"] = str(class_level)

    await db.users.update_one({"id": user_id}, {"$set": update})
    return len(docs)


async def _parse_syllabus_text(raw_text: str) -> dict:
    """Use Claude Sonnet 4.5 to turn raw syllabus text into a subjects→topics map."""
    text = raw_text.strip()
    if not text:
        raise HTTPException(400, "syllabus text is empty")
    # cap input to keep latency / token costs in check
    text = text[:18000]

    sys_msg = (
        "You parse academic syllabi. Given the text, extract a JSON object "
        "describing the structure. Return ONLY valid JSON, with no commentary "
        "and no markdown fencing, in this exact shape:\n"
        '{"subjects": {"Subject Name": ["chapter 1", "chapter 2", ...]}}\n'
        "Rules:\n"
        "- Use 1-8 subjects.\n"
        "- 4-25 chapters per subject.\n"
        "- Use plain Title Case names.\n"
        "- If the document is a single subject, still return one subject.\n"
        "- Skip preamble, exam patterns, and assessment sections.\n"
    )
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"parse-{uuid.uuid4()}",
        system_message=sys_msg,
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")
    try:
        reply = await chat.send_message(
            UserMessage(text=f"SYLLABUS TEXT:\n\n{text}")
        )
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"AI parse failed: {e}") from e

    import json as _json
    s = str(reply).strip()
    # tolerate ```json fences
    if s.startswith("```"):
        s = s.split("```", 2)[1] if "```" in s else s
        if s.startswith("json"):
            s = s[4:]
        s = s.strip("` \n")
    try:
        data = _json.loads(s)
    except _json.JSONDecodeError as e:
        # Last resort: try to slice from first { to last }
        try:
            i = s.index("{")
            j = s.rindex("}")
            data = _json.loads(s[i:j + 1])
        except Exception:
            raise HTTPException(502, f"AI returned non-JSON: {e}") from e

    subjects = data.get("subjects") or {}
    # normalize
    cleaned: dict = {}
    for k, v in subjects.items():
        if not isinstance(v, list):
            continue
        topics = [str(x).strip() for x in v if str(x).strip()]
        if topics:
            cleaned[str(k).strip()] = topics[:30]
    if not cleaned:
        raise HTTPException(422, "no subjects/topics found in document")
    return cleaned


# ─── routes: auth ──────────────────────────────────────────────────────────
@api.get("/")
async def root():
    return {"app": "StudyOS", "ok": True}


@api.post("/auth/signup", response_model=TokenOut)
async def signup(body: SignupIn):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status.HTTP_409_CONFLICT, "email already registered")
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": email,
        "name": body.name.strip(),
        "password_hash": _hash_pw(body.password),
        "country": None,
        "class_level": None,
        "syllabus_source": None,
        "syllabus_name": None,
        "onboarded": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user_doc)
    return TokenOut(
        token=_make_token(user_id),
        user=_user_to_out(user_doc),
    )


@api.post("/auth/login", response_model=TokenOut)
async def login(body: LoginIn):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not _verify_pw(body.password, user["password_hash"]):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid credentials")
    return TokenOut(
        token=_make_token(user["id"]),
        user=_user_to_out(user),
    )


@api.get("/auth/me", response_model=UserOut)
async def me(user=Depends(current_user)):
    return _user_to_out(user)


# ─── routes: profile ───────────────────────────────────────────────────────
class ProfileUpdate(BaseModel):
    country: Optional[str] = None
    class_level: Optional[str] = None


@api.put("/profile", response_model=UserOut)
async def update_profile(body: ProfileUpdate, user=Depends(current_user)):
    update: dict = {}
    if body.country is not None:
        update["country"] = body.country.strip() or None
    if body.class_level is not None:
        update["class_level"] = (body.class_level or "").strip() or None
    if not update:
        return _user_to_out(user)
    await db.users.update_one({"id": user["id"]}, {"$set": update})
    fresh = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    return _user_to_out(fresh)


# ─── routes: syllabus ──────────────────────────────────────────────────────
@api.get("/syllabus/options")
async def syllabus_options():
    """List supported countries + their class levels."""
    countries = []
    for c in list_countries():
        classes = sorted(
            NATIONAL_SYLLABI[c["country"]]["classes"].keys(),
            key=lambda x: int(x),
        )
        countries.append({**c, "classes": classes})
    return {"countries": countries}


@api.get("/syllabus/national")
async def syllabus_national_preview(country: str, class_level: str):
    sy = get_syllabus(country, class_level)
    if not sy:
        raise HTTPException(404, "no national syllabus for that country/class")
    counts = {k: len(v) for k, v in sy["subjects"].items()}
    return {
        "country": sy["country"],
        "class_level": sy["class_level"],
        "name": sy["name"],
        "flag": sy["flag"],
        "subjects": sy["subjects"],
        "subject_counts": counts,
        "total_topics": sum(counts.values()),
    }


class ApplyNationalIn(BaseModel):
    country: str
    class_level: str


@api.post("/syllabus/apply-national", response_model=UserOut)
async def syllabus_apply_national(body: ApplyNationalIn, user=Depends(current_user)):
    sy = get_syllabus(body.country, body.class_level)
    if not sy:
        raise HTTPException(404, "no national syllabus for that country/class")
    await _apply_syllabus_for_user(
        user["id"],
        subjects=sy["subjects"],
        source="national",
        name=sy["name"],
        country=body.country,
        class_level=body.class_level,
    )
    fresh = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    return _user_to_out(fresh)


@api.post("/syllabus/upload", response_model=UserOut)
async def syllabus_upload(
    file: Optional[UploadFile] = File(None),
    text: Optional[str] = Form(None),
    country: Optional[str] = Form(None),
    class_level: Optional[str] = Form(None),
    syllabus_name: Optional[str] = Form(None),
    user=Depends(current_user),
):
    """Accept a PDF or plain-text file, OR pasted text. Parse with Claude
    into subjects→topics, then replace the user's topic list."""
    raw_text = (text or "").strip()
    display_name = (syllabus_name or "").strip() or "uploaded"

    if file:
        content = await file.read()
        if not content:
            raise HTTPException(400, "uploaded file is empty")
        if not display_name or display_name == "uploaded":
            display_name = file.filename or "uploaded"

        fname = (file.filename or "").lower()
        if fname.endswith(".pdf") or (file.content_type and "pdf" in file.content_type):
            try:
                from io import BytesIO
                from pypdf import PdfReader
                reader = PdfReader(BytesIO(content))
                pages_text = []
                for p in reader.pages[:60]:  # cap pages
                    try:
                        pages_text.append(p.extract_text() or "")
                    except Exception:
                        continue
                raw_text = "\n".join(pages_text).strip()
            except Exception as e:
                raise HTTPException(400, f"could not read PDF: {e}") from e
        else:
            try:
                raw_text = content.decode("utf-8", errors="ignore").strip()
            except Exception as e:
                raise HTTPException(400, f"could not read text file: {e}") from e

    if not raw_text:
        raise HTTPException(400, "no syllabus text or file provided")

    subjects = await _parse_syllabus_text(raw_text)
    await _apply_syllabus_for_user(
        user["id"],
        subjects=subjects,
        source="uploaded",
        name=display_name,
        country=country,
        class_level=class_level,
    )
    fresh = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    return _user_to_out(fresh)


@api.post("/syllabus/skip", response_model=UserOut)
async def syllabus_skip(user=Depends(current_user)):
    """Mark the user as onboarded without applying a syllabus — falls back to
    the default seeded sample topics."""
    await _seed_topics_for(user["id"])
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "onboarded": True,
            "syllabus_source": "default",
            "syllabus_name": "Sample topics",
        }},
    )
    fresh = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    return _user_to_out(fresh)


# ─── routes: topics ────────────────────────────────────────────────────────
@api.get("/topics", response_model=List[Topic])
async def list_topics(user=Depends(current_user)):
    docs = await db.topics.find(
        {"user_id": user["id"]}, {"_id": 0, "user_id": 0, "created_at": 0}
    ).to_list(500)
    for d in docs:
        d.setdefault("last_touched_at", None)
    return docs


# ─── routes: sessions ──────────────────────────────────────────────────────
@api.post("/sessions/start", response_model=Session)
async def start_session(body: StartSessionIn, user=Depends(current_user)):
    topic = await db.topics.find_one({"id": body.topic_id, "user_id": user["id"]}, {"_id": 0})
    if not topic:
        raise HTTPException(404, "topic not found")
    sess = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "topic_id": topic["id"],
        "topic_name": topic["name"],
        "duration_minutes": body.duration_minutes,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "ended_at": None,
        "struggle_score": 0,
        "mastery_delta": 0,
    }
    await db.sessions.insert_one(sess)
    await db.topics.update_one(
        {"id": topic["id"], "user_id": user["id"]},
        {"$set": {"last_touched_at": sess["started_at"]}},
    )
    return Session(**{k: v for k, v in sess.items() if k != "user_id"})


@api.post("/sessions/{session_id}/struggle", response_model=Session)
async def update_struggle(session_id: str, body: StruggleIn, user=Depends(current_user)):
    res = await db.sessions.find_one_and_update(
        {"id": session_id, "user_id": user["id"]},
        {"$set": {"struggle_score": body.struggle_score}},
        return_document=True,
        projection={"_id": 0, "user_id": 0},
    )
    if not res:
        raise HTTPException(404, "session not found")
    return Session(**res)


@api.post("/sessions/{session_id}/end", response_model=Session)
async def end_session(session_id: str, body: EndSessionIn, user=Depends(current_user)):
    sess = await db.sessions.find_one({"id": session_id, "user_id": user["id"]})
    if not sess:
        raise HTTPException(404, "session not found")
    ended_at = datetime.now(timezone.utc).isoformat()
    await db.sessions.update_one(
        {"id": session_id, "user_id": user["id"]},
        {"$set": {"ended_at": ended_at, "mastery_delta": body.mastery_delta}},
    )
    # apply mastery delta to topic
    topic = await db.topics.find_one({"id": sess["topic_id"], "user_id": user["id"]})
    if topic:
        new_mastery = max(0, min(100, int(topic["mastery"]) + body.mastery_delta))
        await db.topics.update_one(
            {"id": sess["topic_id"], "user_id": user["id"]},
            {"$set": {"mastery": new_mastery}},
        )
    sess.update({"ended_at": ended_at, "mastery_delta": body.mastery_delta})
    sess.pop("_id", None)
    sess.pop("user_id", None)
    return Session(**sess)


@api.get("/sessions", response_model=List[Session])
async def list_sessions(user=Depends(current_user)):
    docs = await db.sessions.find(
        {"user_id": user["id"]}, {"_id": 0, "user_id": 0}
    ).sort("started_at", -1).to_list(50)
    return docs


# ─── routes: socratic chat ─────────────────────────────────────────────────
@api.post("/chat/socratic", response_model=ChatMessage)
async def socratic(body: ChatIn, user=Depends(current_user)):
    sess = await db.sessions.find_one({"id": body.session_id, "user_id": user["id"]})
    if not sess:
        raise HTTPException(404, "session not found")

    # persist user msg
    user_msg = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "session_id": body.session_id,
        "role": "user",
        "text": body.text,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.chat_messages.insert_one(user_msg)

    # build chat with full history (multi-turn)
    history = await db.chat_messages.find(
        {"session_id": body.session_id, "user_id": user["id"]},
        {"_id": 0},
    ).sort("created_at", 1).to_list(100)

    sys_msg = (
        f"{SOCRATIC_SYSTEM}\n\nCurrent topic: {sess['topic_name']}. "
        f"Struggle score (0–100): {body.struggle_score}."
    )
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=body.session_id,
        system_message=sys_msg,
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")

    # Replay all but the last (current) user message so the library knows context,
    # then send the current message.
    try:
        for h in history[:-1]:
            if h["role"] == "user":
                await chat.send_message(UserMessage(text=h["text"]))
        reply = await chat.send_message(UserMessage(text=body.text))
    except Exception as e:  # noqa: BLE001
        logger.exception("socratic chat failed")
        raise HTTPException(502, f"AI provider error: {e}") from e

    asst = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "session_id": body.session_id,
        "role": "assistant",
        "text": str(reply).strip(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.chat_messages.insert_one(asst)
    asst.pop("user_id", None)
    return ChatMessage(**asst)


@api.get("/chat/history", response_model=List[ChatMessage])
async def chat_history(session_id: str, user=Depends(current_user)):
    docs = await db.chat_messages.find(
        {"session_id": session_id, "user_id": user["id"]},
        {"_id": 0, "user_id": 0},
    ).sort("created_at", 1).to_list(500)
    return docs


# ─── routes: Q&A engine ────────────────────────────────────────────────────
class Question(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    session_id: str
    topic_id: str
    topic_name: str
    prompt: str
    expected: str
    difficulty: str
    type: str = "short_answer"
    created_at: str


class AskQuestionIn(BaseModel):
    easier: bool = False  # forced easy difficulty


class SubmitAnswerIn(BaseModel):
    question_id: str
    answer: str
    elapsed_ms: int = 0


class AnswerResult(BaseModel):
    model_config = ConfigDict(extra="ignore")
    question_id: str
    correct: bool
    score: int
    feedback: str
    streak_correct: int
    streak_wrong: int
    total_answered: int
    accuracy: float
    should_interrupt: bool = False
    interrupt_reason: Optional[str] = None
    next_difficulty: str
    insight: str  # short HUD line


def _safe_json(s: str) -> dict:
    """Tolerant JSON parser: strips ```json fences, slices first { to last }."""
    import json as _json
    s = (s or "").strip()
    if s.startswith("```"):
        s = s.split("```", 2)[1] if "```" in s else s
        if s.startswith("json"):
            s = s[4:]
        s = s.strip("` \n")
    try:
        return _json.loads(s)
    except _json.JSONDecodeError:
        try:
            i = s.index("{")
            j = s.rindex("}")
            return _json.loads(s[i:j + 1])
        except Exception:
            return {}


async def _gen_question(topic_name: str, domain: str, difficulty: str, avoid: list[str]) -> dict:
    avoid_str = ""
    if avoid:
        joined = " | ".join(a[:120] for a in avoid[-5:])
        avoid_str = f" Avoid duplicating these previous prompts: {joined}."
    sys_msg = (
        "You are an expert tutor. Generate ONE concise, original practice question for the topic. "
        "Return ONLY valid JSON with no markdown, no commentary, in this exact form:\n"
        '{"prompt": "the question text", "expected": "model answer or key idea (1-3 lines)", '
        '"difficulty": "easy|medium|hard"}\n'
        "Rules:\n"
        "- prompt: 1-3 sentences, solvable in under 4 minutes, exam-style\n"
        "- match the requested difficulty\n"
        "- expected: a brief model answer or key concept that lets a grader check correctness\n"
        "- avoid trick questions and ambiguity"
    )
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"q-{uuid.uuid4()}",
        system_message=sys_msg,
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")
    user_text = f"Topic: {topic_name} ({domain}). Difficulty: {difficulty}.{avoid_str}"
    try:
        reply = await chat.send_message(UserMessage(text=user_text))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"AI question gen failed: {e}") from e
    data = _safe_json(str(reply))
    if not data.get("prompt") or not data.get("expected"):
        raise HTTPException(502, "AI returned malformed question")
    data.setdefault("difficulty", difficulty)
    return data


async def _eval_answer(prompt: str, expected: str, answer: str) -> dict:
    sys_msg = (
        "You are a fair, encouraging tutor. Compare the student's answer to the expected answer "
        "and decide correctness. Be lenient on phrasing if the core idea is right. "
        "Return ONLY valid JSON: "
        '{"correct": true|false, "score": 0-100, "feedback": "1-2 sentences, no preaching, no emoji"}.'
    )
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"ev-{uuid.uuid4()}",
        system_message=sys_msg,
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")
    text = (
        f"QUESTION: {prompt}\n\n"
        f"EXPECTED: {expected}\n\n"
        f"STUDENT ANSWER: {answer}"
    )
    try:
        reply = await chat.send_message(UserMessage(text=text))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"AI eval failed: {e}") from e
    data = _safe_json(str(reply))
    if "correct" not in data:
        # fallback heuristic if AI failed
        return {
            "correct": False,
            "score": 0,
            "feedback": "Could not evaluate that automatically — try again.",
        }
    data["correct"] = bool(data["correct"])
    data["score"] = max(0, min(100, int(data.get("score", 0))))
    data["feedback"] = str(data.get("feedback", "")).strip() or "Noted."
    return data


def _next_difficulty(current: str, last_correct: bool, streak_correct: int, streak_wrong: int) -> str:
    if streak_correct >= 2:
        if current == "easy":
            return "medium"
        if current == "medium":
            return "hard"
        return "hard"
    if streak_wrong >= 2:
        if current == "hard":
            return "medium"
        if current == "medium":
            return "easy"
        return "easy"
    return current


def _live_insight(streak_correct: int, streak_wrong: int, accuracy: float, idle_high: bool) -> str:
    if streak_wrong >= 3:
        return "the room is breathing — let's slow down and try an easier path."
    if streak_correct >= 3:
        return "fast streak — pushing the difficulty up."
    if streak_wrong == 2:
        return "two off in a row — focus on the core idea, not the detail."
    if accuracy >= 0.8 and streak_correct >= 1:
        return "in flow."
    if idle_high:
        return "you're slowing down — take one breath, then commit."
    return "steady."


@api.post("/sessions/{session_id}/question", response_model=Question)
async def session_next_question(session_id: str, body: AskQuestionIn = AskQuestionIn(), user=Depends(current_user)):
    sess = await db.sessions.find_one({"id": session_id, "user_id": user["id"]})
    if not sess:
        raise HTTPException(404, "session not found")
    topic = await db.topics.find_one({"id": sess["topic_id"], "user_id": user["id"]})
    if not topic:
        raise HTTPException(404, "topic not found")

    # streak-aware difficulty (or forced easy via `easier`)
    streak_correct = sess.get("streak_correct", 0)
    streak_wrong = sess.get("streak_wrong", 0)
    last_difficulty = sess.get("last_difficulty", "medium")
    if body.easier:
        difficulty = "easy"
    else:
        # advance based on prior streak
        difficulty = _next_difficulty(last_difficulty, True, streak_correct, streak_wrong)

    # avoid recent prompts
    recent = await db.questions.find(
        {"session_id": session_id, "user_id": user["id"]},
        {"_id": 0, "prompt": 1},
    ).sort("created_at", -1).to_list(8)
    avoid = [r["prompt"] for r in recent]

    gen = await _gen_question(topic["name"], topic.get("domain", ""), difficulty, avoid)

    q_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "session_id": session_id,
        "topic_id": topic["id"],
        "topic_name": topic["name"],
        "prompt": gen["prompt"],
        "expected": gen["expected"],
        "difficulty": gen.get("difficulty", difficulty),
        "type": "short_answer",
        "answered": False,
        "correct": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.questions.insert_one(q_doc)
    await db.sessions.update_one(
        {"id": session_id, "user_id": user["id"]},
        {"$set": {"last_difficulty": q_doc["difficulty"]}},
    )
    out = {k: v for k, v in q_doc.items() if k not in {"user_id", "answered", "correct"}}
    return Question(**out)


@api.post("/sessions/{session_id}/answer", response_model=AnswerResult)
async def session_submit_answer(session_id: str, body: SubmitAnswerIn, user=Depends(current_user)):
    sess = await db.sessions.find_one({"id": session_id, "user_id": user["id"]})
    if not sess:
        raise HTTPException(404, "session not found")
    q = await db.questions.find_one({"id": body.question_id, "user_id": user["id"]})
    if not q:
        raise HTTPException(404, "question not found")
    if q.get("answered"):
        raise HTTPException(409, "question already answered")

    eval_result = await _eval_answer(q["prompt"], q["expected"], body.answer)
    correct = eval_result["correct"]

    streak_correct = sess.get("streak_correct", 0)
    streak_wrong = sess.get("streak_wrong", 0)
    if correct:
        streak_correct += 1
        streak_wrong = 0
    else:
        streak_wrong += 1
        streak_correct = 0

    total = sess.get("total_answered", 0) + 1
    correct_count = sess.get("correct_count", 0) + (1 if correct else 0)
    accuracy = correct_count / total if total else 0.0
    struggle_score = max(0, min(100, sess.get("struggle_score", 0)))
    idle_high = struggle_score > 60

    insight = _live_insight(streak_correct, streak_wrong, accuracy, idle_high)
    next_difficulty = _next_difficulty(q["difficulty"], correct, streak_correct, streak_wrong)

    should_interrupt = streak_wrong >= 3 or struggle_score > 80
    interrupt_reason = None
    if streak_wrong >= 3:
        interrupt_reason = f"3 wrong in a row on {q['topic_name'].lower()}"
    elif struggle_score > 80:
        interrupt_reason = "cognitive load is high"

    # mark question
    await db.questions.update_one(
        {"id": body.question_id},
        {"$set": {
            "answered": True,
            "correct": correct,
            "score": eval_result["score"],
            "feedback": eval_result["feedback"],
            "answer": body.answer,
            "elapsed_ms": int(body.elapsed_ms or 0),
            "answered_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    # update session counters
    await db.sessions.update_one(
        {"id": session_id, "user_id": user["id"]},
        {"$set": {
            "streak_correct": streak_correct,
            "streak_wrong": streak_wrong,
            "total_answered": total,
            "correct_count": correct_count,
            "last_difficulty": next_difficulty,
        }},
    )

    return AnswerResult(
        question_id=body.question_id,
        correct=correct,
        score=eval_result["score"],
        feedback=eval_result["feedback"],
        streak_correct=streak_correct,
        streak_wrong=streak_wrong,
        total_answered=total,
        accuracy=round(accuracy, 3),
        should_interrupt=should_interrupt,
        interrupt_reason=interrupt_reason,
        next_difficulty=next_difficulty,
        insight=insight,
    )


@api.post("/sessions/{session_id}/event")
async def session_event(session_id: str, body: dict, user=Depends(current_user)):
    """Log a behavior event: 'easier_requested' | 'replay' | 'interrupt_dismissed'."""
    sess = await db.sessions.find_one({"id": session_id, "user_id": user["id"]})
    if not sess:
        raise HTTPException(404, "session not found")
    ev = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "session_id": session_id,
        "topic_id": sess.get("topic_id"),
        "type": str(body.get("type", "unknown"))[:64],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.events.insert_one(ev)
    return {"ok": True, "id": ev["id"]}


# ─── routes: insights ──────────────────────────────────────────────────────
@api.get("/insights")
async def insights(user=Depends(current_user)):
    user_id = user["id"]
    topics = await db.topics.find(
        {"user_id": user_id}, {"_id": 0, "user_id": 0}
    ).to_list(500)
    questions = await db.questions.find(
        {"user_id": user_id, "answered": True},
        {"_id": 0, "user_id": 0},
    ).to_list(2000)
    sessions = await db.sessions.find(
        {"user_id": user_id}, {"_id": 0, "user_id": 0}
    ).to_list(500)
    events = await db.events.find(
        {"user_id": user_id}, {"_id": 0, "user_id": 0}
    ).to_list(500)

    # accuracy by topic_id
    by_topic: dict = {}
    for q in questions:
        t = by_topic.setdefault(q.get("topic_id"), {"total": 0, "correct": 0, "name": q.get("topic_name", "")})
        t["total"] += 1
        if q.get("correct"):
            t["correct"] += 1

    # weak topics: lowest mastery (preferred) or lowest accuracy
    weak_sorted = sorted(topics, key=lambda x: (x.get("mastery", 0), x.get("name", "")))[:5]
    weak_topics = []
    for t in weak_sorted:
        acc = None
        bt = by_topic.get(t["id"])
        if bt and bt["total"]:
            acc = round(bt["correct"] / bt["total"] * 100)
        weak_topics.append({
            "id": t["id"],
            "name": t["name"],
            "domain": t.get("domain", ""),
            "mastery": t.get("mastery", 0),
            "accuracy": acc,
        })

    # patterns
    patterns = []
    avg_struggle = (
        sum(s.get("struggle_score", 0) for s in sessions) / max(1, len(sessions))
    )
    if avg_struggle > 55:
        patterns.append({
            "label": "often hits cognitive overload",
            "detail": f"avg struggle score {avg_struggle:.0f} across {len(sessions)} sessions",
        })

    easier_events = [e for e in events if e.get("type") == "easier_requested"]
    if len(easier_events) >= 2:
        patterns.append({
            "label": "tends to switch to easier when challenged",
            "detail": f"{len(easier_events)} easier-mode requests",
        })

    avoidance_topics = [t["name"] for t in topics if t.get("mastery", 0) < 30]
    if len(avoidance_topics) >= 3:
        patterns.append({
            "label": "avoids difficult topics",
            "detail": f"{len(avoidance_topics)} topics still under 30% mastery",
        })

    if any(s.get("streak_wrong", 0) >= 3 for s in sessions):
        patterns.append({
            "label": "wrong-answer cascades during sessions",
            "detail": "got 3+ wrong in a row in at least one session",
        })

    # predictions: rough rule-based marks loss per topic
    predictions = []
    for t in weak_sorted:
        if t.get("mastery", 0) < 60:
            est = round((100 - t.get("mastery", 0)) / 100 * 18)
            predictions.append({
                "topic": t["name"],
                "domain": t.get("domain", ""),
                "marks_loss_min": max(3, est - 3),
                "marks_loss_max": est + 3,
            })

    # session totals
    total_questions = len(questions)
    total_correct = sum(1 for q in questions if q.get("correct"))
    overall_accuracy = (
        round(total_correct / total_questions * 100) if total_questions else None
    )

    return {
        "weak_topics": weak_topics,
        "patterns": patterns,
        "predictions": predictions,
        "totals": {
            "topics": len(topics),
            "sessions": len(sessions),
            "questions": total_questions,
            "correct": total_correct,
            "overall_accuracy": overall_accuracy,
        },
    }


# ─── plumbing ──────────────────────────────────────────────────────────────
app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("studyos")


@app.on_event("shutdown")
async def _shutdown():
    client.close()


TokenOut.model_rebuild()
