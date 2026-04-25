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
