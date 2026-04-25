"""StudyOS / ContextOS backend API tests."""
import os
import time
import uuid

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://context-peaks.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


# ─── shared state across the whole module ───────────────────────────────────
state = {}


@pytest.fixture(scope="module", autouse=True)
def signup_user():
    """Create a fresh user once, share token + user across tests."""
    email = f"test_{uuid.uuid4().hex[:10]}@example.com"
    password = "test-pass-1234"
    name = "Test User"

    r = requests.post(f"{API}/auth/signup", json={"email": email, "password": password, "name": name}, timeout=20)
    assert r.status_code == 200, f"signup failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data and "user" in data
    assert data["user"]["email"] == email
    assert data["user"]["name"] == name
    assert isinstance(data["user"]["id"], str)
    state["email"] = email
    state["password"] = password
    state["token"] = data["token"]
    state["user"] = data["user"]
    state["headers"] = {"Authorization": f"Bearer {data['token']}", "Content-Type": "application/json"}
    # Backend no longer auto-seeds topics on signup; use /syllabus/skip to seed
    # the default 10 sample topics so the rest of this suite (which assumes
    # those topics exist) keeps working.
    rs = requests.post(f"{API}/syllabus/skip", headers=state["headers"], timeout=15)
    assert rs.status_code == 200, f"skip-onboarding failed: {rs.status_code} {rs.text}"
    yield


# ─── auth ───────────────────────────────────────────────────────────────────
class TestAuth:
    def test_root(self):
        r = requests.get(f"{API}/", timeout=10)
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_signup_duplicate_email(self):
        r = requests.post(
            f"{API}/auth/signup",
            json={"email": state["email"], "password": "another", "name": "x"},
            timeout=15,
        )
        assert r.status_code == 409

    def test_login_success(self):
        r = requests.post(
            f"{API}/auth/login",
            json={"email": state["email"], "password": state["password"]},
            timeout=15,
        )
        assert r.status_code == 200
        d = r.json()
        assert "token" in d and d["user"]["email"] == state["email"]

    def test_login_bad_password(self):
        r = requests.post(
            f"{API}/auth/login",
            json={"email": state["email"], "password": "wrong-password"},
            timeout=15,
        )
        assert r.status_code == 401

    def test_me_with_token(self):
        r = requests.get(f"{API}/auth/me", headers=state["headers"], timeout=10)
        assert r.status_code == 200
        assert r.json()["email"] == state["email"]

    def test_me_without_token(self):
        r = requests.get(f"{API}/auth/me", timeout=10)
        assert r.status_code == 401

    def test_me_with_bad_token(self):
        r = requests.get(f"{API}/auth/me", headers={"Authorization": "Bearer junk.token.here"}, timeout=10)
        assert r.status_code == 401


# ─── topics ─────────────────────────────────────────────────────────────────
class TestTopics:
    def test_list_topics_seeded(self):
        r = requests.get(f"{API}/topics", headers=state["headers"], timeout=10)
        assert r.status_code == 200
        topics = r.json()
        assert len(topics) == 10, f"expected 10 seeded topics, got {len(topics)}"
        first = topics[0]
        for k in ("id", "name", "domain", "mastery", "x", "y"):
            assert k in first, f"missing key {k}"
        for t in topics:
            assert 0 <= t["mastery"] <= 100
            assert 0 <= t["x"] <= 1
            assert 0 <= t["y"] <= 1
            # NEW: every topic must include last_touched_at field, null until first session
            assert "last_touched_at" in t, f"missing last_touched_at on topic {t['name']}"
            assert t["last_touched_at"] is None
        state["topics"] = topics

    def test_start_session_updates_last_touched_at(self):
        """POST /api/sessions/start must update topic.last_touched_at."""
        topic = state["topics"][2]  # use a fresh topic not used elsewhere
        r = requests.post(
            f"{API}/sessions/start",
            headers=state["headers"],
            json={"topic_id": topic["id"], "duration_minutes": 15},
            timeout=10,
        )
        assert r.status_code == 200
        # GET topics, the touched one must now have a non-null last_touched_at
        r2 = requests.get(f"{API}/topics", headers=state["headers"], timeout=10)
        updated = next(t for t in r2.json() if t["id"] == topic["id"])
        assert updated["last_touched_at"] is not None
        assert isinstance(updated["last_touched_at"], str)

    def test_topics_idempotent_seed_on_login(self):
        # login again → still 10 topics, not 20
        r = requests.post(
            f"{API}/auth/login",
            json={"email": state["email"], "password": state["password"]},
            timeout=15,
        )
        assert r.status_code == 200
        r2 = requests.get(f"{API}/topics", headers=state["headers"], timeout=10)
        assert len(r2.json()) == 10


# ─── sessions ───────────────────────────────────────────────────────────────
class TestSessions:
    def test_start_session(self):
        topic = state["topics"][0]
        r = requests.post(
            f"{API}/sessions/start",
            headers=state["headers"],
            json={"topic_id": topic["id"], "duration_minutes": 25},
            timeout=10,
        )
        assert r.status_code == 200
        s = r.json()
        assert s["topic_id"] == topic["id"]
        assert s["topic_name"] == topic["name"]
        assert s["duration_minutes"] == 25
        assert s["struggle_score"] == 0
        assert s["ended_at"] is None
        state["session"] = s
        state["topic_used"] = topic

    def test_start_session_bad_topic(self):
        r = requests.post(
            f"{API}/sessions/start",
            headers=state["headers"],
            json={"topic_id": "non-existent", "duration_minutes": 25},
            timeout=10,
        )
        assert r.status_code == 404

    def test_update_struggle(self):
        sid = state["session"]["id"]
        r = requests.post(
            f"{API}/sessions/{sid}/struggle",
            headers=state["headers"],
            json={"struggle_score": 75},
            timeout=10,
        )
        assert r.status_code == 200
        assert r.json()["struggle_score"] == 75

    def test_struggle_bounds(self):
        sid = state["session"]["id"]
        # over 100 → 422
        r = requests.post(
            f"{API}/sessions/{sid}/struggle",
            headers=state["headers"],
            json={"struggle_score": 150},
            timeout=10,
        )
        assert r.status_code == 422

    def test_end_session_applies_mastery(self):
        sid = state["session"]["id"]
        topic = state["topic_used"]
        original = topic["mastery"]
        delta = 5
        r = requests.post(
            f"{API}/sessions/{sid}/end",
            headers=state["headers"],
            json={"mastery_delta": delta},
            timeout=10,
        )
        assert r.status_code == 200
        body = r.json()
        assert body["ended_at"] is not None
        assert body["mastery_delta"] == delta

        # verify topic mastery changed
        r2 = requests.get(f"{API}/topics", headers=state["headers"], timeout=10)
        updated = next(t for t in r2.json() if t["id"] == topic["id"])
        expected = max(0, min(100, original + delta))
        assert updated["mastery"] == expected, f"expected {expected}, got {updated['mastery']}"

    def test_mastery_clamped_at_100(self):
        # find topic with highest mastery
        r = requests.get(f"{API}/topics", headers=state["headers"], timeout=10)
        topics = r.json()
        top = max(topics, key=lambda t: t["mastery"])
        # start session and apply +20 multiple times to push above 100
        sess = requests.post(
            f"{API}/sessions/start",
            headers=state["headers"],
            json={"topic_id": top["id"], "duration_minutes": 10},
            timeout=10,
        ).json()
        requests.post(
            f"{API}/sessions/{sess['id']}/end",
            headers=state["headers"],
            json={"mastery_delta": 20},
            timeout=10,
        )
        r2 = requests.get(f"{API}/topics", headers=state["headers"], timeout=10)
        updated = next(t for t in r2.json() if t["id"] == top["id"])
        assert updated["mastery"] <= 100

    def test_list_sessions_sorted_desc(self):
        r = requests.get(f"{API}/sessions", headers=state["headers"], timeout=10)
        assert r.status_code == 200
        sessions = r.json()
        assert len(sessions) >= 2
        starts = [s["started_at"] for s in sessions]
        assert starts == sorted(starts, reverse=True)


# ─── socratic chat (Claude sonnet 4.5) ──────────────────────────────────────
class TestSocraticChat:
    def test_chat_send_and_history(self):
        # need an open session. create one.
        topic = state["topics"][1]
        sess = requests.post(
            f"{API}/sessions/start",
            headers=state["headers"],
            json={"topic_id": topic["id"], "duration_minutes": 15},
            timeout=10,
        ).json()
        state["chat_session_id"] = sess["id"]

        r = requests.post(
            f"{API}/chat/socratic",
            headers=state["headers"],
            json={
                "session_id": sess["id"],
                "text": "i'm stuck on what an eigenvalue actually means.",
                "struggle_score": 70,
            },
            timeout=120,  # LLM latency
        )
        assert r.status_code == 200, f"chat failed: {r.status_code} {r.text}"
        m = r.json()
        assert m["role"] == "assistant"
        assert isinstance(m["text"], str) and len(m["text"]) > 0
        assert m["session_id"] == sess["id"]

        # history endpoint shows both messages
        time.sleep(0.5)
        h = requests.get(
            f"{API}/chat/history",
            params={"session_id": sess["id"]},
            headers=state["headers"],
            timeout=10,
        )
        assert h.status_code == 200
        msgs = h.json()
        roles = [m["role"] for m in msgs]
        assert "user" in roles and "assistant" in roles
        assert len(msgs) >= 2

    def test_chat_invalid_session(self):
        r = requests.post(
            f"{API}/chat/socratic",
            headers=state["headers"],
            json={"session_id": "no-such-session", "text": "hello", "struggle_score": 0},
            timeout=15,
        )
        assert r.status_code == 404
