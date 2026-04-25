"""Q&A engine tests: question generation, answer evaluation, struggle interrupt, events, insights."""
from __future__ import annotations

import os
import uuid

import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ctx: dict = {}


@pytest.fixture(scope="module", autouse=True)
def fresh_user_with_cbse():
    """Signup → apply India class 10 (CBSE NCERT, 50 topics) → start session on Real Numbers."""
    email = f"test_{uuid.uuid4().hex[:10]}@example.com"
    password = "test-pass-1234"
    r = requests.post(
        f"{API}/auth/signup",
        json={"email": email, "password": password, "name": "QA Tester"},
        timeout=20,
    )
    assert r.status_code == 200, r.text
    token = r.json()["token"]
    h = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    rs = requests.post(
        f"{API}/syllabus/apply-national",
        headers=h,
        json={"country": "India", "class_level": "10"},
        timeout=30,
    )
    assert rs.status_code == 200, rs.text

    rt = requests.get(f"{API}/topics", headers=h, timeout=10)
    topics = rt.json()
    assert len(topics) == 50
    real_numbers = next(t for t in topics if t["name"] == "Real Numbers")

    rsess = requests.post(
        f"{API}/sessions/start",
        headers=h,
        json={"topic_id": real_numbers["id"], "duration_minutes": 25},
        timeout=15,
    )
    assert rsess.status_code == 200
    sess = rsess.json()

    ctx["headers"] = h
    ctx["topic"] = real_numbers
    ctx["session"] = sess
    yield


# ─── question generation ────────────────────────────────────────────────────
class TestQuestionGen:
    def test_first_question_medium(self):
        sid = ctx["session"]["id"]
        r = requests.post(
            f"{API}/sessions/{sid}/question",
            headers=ctx["headers"],
            json={},
            timeout=60,
        )
        assert r.status_code == 200, r.text
        q = r.json()
        for k in ("id", "prompt", "expected", "difficulty", "topic_name", "session_id", "topic_id"):
            assert k in q, f"missing {k}"
        assert q["difficulty"] == "medium"
        assert isinstance(q["prompt"], str) and len(q["prompt"]) > 5
        assert q["topic_name"] == ctx["topic"]["name"]
        assert q["session_id"] == sid
        ctx["q_medium"] = q

    def test_easier_request(self):
        sid = ctx["session"]["id"]
        r = requests.post(
            f"{API}/sessions/{sid}/question",
            headers=ctx["headers"],
            json={"easier": True},
            timeout=60,
        )
        assert r.status_code == 200
        q = r.json()
        assert q["difficulty"] == "easy"
        ctx["q_easy"] = q


# ─── answer evaluation + struggle interrupt ─────────────────────────────────
class TestAnswerFlow:
    def _ask_and_answer(self, answer_text: str) -> dict:
        sid = ctx["session"]["id"]
        rq = requests.post(
            f"{API}/sessions/{sid}/question",
            headers=ctx["headers"],
            json={},
            timeout=60,
        )
        assert rq.status_code == 200
        q = rq.json()
        ra = requests.post(
            f"{API}/sessions/{sid}/answer",
            headers=ctx["headers"],
            json={"question_id": q["id"], "answer": answer_text, "elapsed_ms": 5000},
            timeout=60,
        )
        assert ra.status_code == 200, ra.text
        return {"q": q, "a": ra.json()}

    def test_first_wrong_answer(self):
        # Use the q_medium from previous class (already generated) plus first NEW wrong answer flow
        # Submit a clearly-wrong answer to the first medium question.
        sid = ctx["session"]["id"]
        q = ctx["q_medium"]
        ra = requests.post(
            f"{API}/sessions/{sid}/answer",
            headers=ctx["headers"],
            json={"question_id": q["id"], "answer": "purple banana sandwich", "elapsed_ms": 4000},
            timeout=60,
        )
        assert ra.status_code == 200, ra.text
        result = ra.json()
        assert result["correct"] is False
        assert result["score"] == 0 or result["score"] < 30
        assert result["streak_wrong"] == 1
        assert result["total_answered"] == 1
        assert result["accuracy"] == 0
        assert result["should_interrupt"] is False
        # next_difficulty stays medium after one wrong
        assert result["next_difficulty"] == "medium"
        assert result["insight"] == "steady."

    def test_double_answer_returns_409(self):
        sid = ctx["session"]["id"]
        q = ctx["q_medium"]
        ra = requests.post(
            f"{API}/sessions/{sid}/answer",
            headers=ctx["headers"],
            json={"question_id": q["id"], "answer": "another try", "elapsed_ms": 1000},
            timeout=30,
        )
        assert ra.status_code == 409, ra.text

    def test_two_more_wrong_triggers_interrupt(self):
        # Need easy question already exists (q_easy) — answer it wrong (#2)
        sid = ctx["session"]["id"]
        q2 = ctx["q_easy"]
        ra2 = requests.post(
            f"{API}/sessions/{sid}/answer",
            headers=ctx["headers"],
            json={"question_id": q2["id"], "answer": "completely wrong nonsense xyz", "elapsed_ms": 4000},
            timeout=60,
        )
        assert ra2.status_code == 200
        r2 = ra2.json()
        assert r2["correct"] is False
        assert r2["streak_wrong"] == 2
        assert r2["should_interrupt"] is False

        # Generate a third question and answer it wrong (#3)
        rq3 = requests.post(
            f"{API}/sessions/{sid}/question",
            headers=ctx["headers"],
            json={"easier": True},
            timeout=60,
        )
        assert rq3.status_code == 200
        q3 = rq3.json()
        ra3 = requests.post(
            f"{API}/sessions/{sid}/answer",
            headers=ctx["headers"],
            json={"question_id": q3["id"], "answer": "nope nope nope", "elapsed_ms": 4000},
            timeout=60,
        )
        assert ra3.status_code == 200
        r3 = ra3.json()
        assert r3["correct"] is False
        assert r3["streak_wrong"] == 3
        assert r3["should_interrupt"] is True
        assert r3["interrupt_reason"]
        assert "3 wrong in a row" in r3["interrupt_reason"]
        assert ctx["topic"]["name"].lower() in r3["interrupt_reason"]
        assert r3["insight"].startswith("the room is breathing")


# ─── events ─────────────────────────────────────────────────────────────────
class TestEvents:
    def test_easier_requested_event(self):
        sid = ctx["session"]["id"]
        r = requests.post(
            f"{API}/sessions/{sid}/event",
            headers=ctx["headers"],
            json={"type": "easier_requested"},
            timeout=10,
        )
        assert r.status_code == 200
        body = r.json()
        assert body.get("ok") is True


# ─── insights ───────────────────────────────────────────────────────────────
class TestInsights:
    def test_insights_shape(self):
        # By now session has 3 wrong answers; user has 50 CBSE topics @ mastery 25.
        r = requests.get(f"{API}/insights", headers=ctx["headers"], timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        for k in ("weak_topics", "patterns", "predictions", "totals"):
            assert k in body, f"missing {k}"
        weak = body["weak_topics"]
        assert isinstance(weak, list) and len(weak) == 5
        for t in weak:
            assert "name" in t and "mastery" in t
            assert t["mastery"] == 25
        totals = body["totals"]
        assert totals["topics"] == 50
        assert totals["sessions"] >= 1
        assert totals["questions"] >= 3
        assert totals["correct"] == 0
        assert totals["overall_accuracy"] == 0


# ─── insights fresh user (no answers) ──────────────────────────────────────
class TestInsightsFresh:
    def test_fresh_user_overall_accuracy_none(self):
        email = f"test_{uuid.uuid4().hex[:10]}@example.com"
        r = requests.post(
            f"{API}/auth/signup",
            json={"email": email, "password": "test-pass-1234", "name": "Fresh"},
            timeout=20,
        )
        h = {"Authorization": f"Bearer {r.json()['token']}", "Content-Type": "application/json"}
        requests.post(
            f"{API}/syllabus/apply-national",
            headers=h,
            json={"country": "India", "class_level": "10"},
            timeout=30,
        )
        ri = requests.get(f"{API}/insights", headers=h, timeout=10)
        assert ri.status_code == 200
        body = ri.json()
        assert body["totals"]["topics"] == 50
        assert body["totals"]["questions"] == 0
        assert len(body["weak_topics"]) == 5
