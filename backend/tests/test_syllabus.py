"""StudyOS syllabus-feature backend tests.

Covers:
- /syllabus/options (list of supported countries)
- /syllabus/national (preview)
- /syllabus/apply-national (replaces topics + flips onboarded)
- /syllabus/upload (text + file paths via Claude parse)
- /syllabus/skip (default seed)
- Profile update & full UserOut shape
"""
from __future__ import annotations

import io
import os
import uuid

import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"


# ─── shared user fixture (NOT auto-onboarded) ──────────────────────────────
shared: dict = {}


@pytest.fixture(scope="module", autouse=True)
def _signup():
    email = f"test_{uuid.uuid4().hex[:10]}@example.com"
    password = "test-pass-1234"
    r = requests.post(
        f"{API}/auth/signup",
        json={"email": email, "password": password, "name": "Syl Tester"},
        timeout=20,
    )
    assert r.status_code == 200, f"signup failed: {r.status_code} {r.text}"
    data = r.json()
    shared["email"] = email
    shared["password"] = password
    shared["token"] = data["token"]
    shared["user"] = data["user"]
    shared["headers"] = {"Authorization": f"Bearer {data['token']}"}
    # signup must NOT auto-onboard or auto-seed topics
    assert data["user"]["onboarded"] is False
    yield


def _h_json():
    return {**shared["headers"], "Content-Type": "application/json"}


# ─── /syllabus/options ──────────────────────────────────────────────────────
class TestSyllabusOptions:
    def test_options_returns_5_countries(self):
        r = requests.get(f"{API}/syllabus/options", timeout=10)
        assert r.status_code == 200
        body = r.json()
        countries = body.get("countries", [])
        names = [c["country"] for c in countries]
        for expected in [
            "India", "United States", "United Kingdom", "Canada", "Australia",
        ]:
            assert expected in names, f"missing country {expected}: {names}"
        # Each country has classes
        for c in countries:
            assert "name" in c and "flag" in c and "classes" in c
            assert isinstance(c["classes"], list) and len(c["classes"]) >= 1

    def test_india_has_classes_8_to_12(self):
        r = requests.get(f"{API}/syllabus/options", timeout=10)
        india = next(c for c in r.json()["countries"] if c["country"] == "India")
        for cl in ["8", "9", "10", "11", "12"]:
            assert cl in india["classes"]


# ─── /syllabus/national preview ────────────────────────────────────────────
class TestSyllabusNational:
    def test_india_class_10_preview(self):
        r = requests.get(
            f"{API}/syllabus/national",
            params={"country": "India", "class_level": "10"},
            timeout=10,
        )
        assert r.status_code == 200
        body = r.json()
        assert body["country"] == "India"
        assert body["class_level"] == "10"
        assert body["name"] == "CBSE NCERT"
        # exactly 4 subjects
        subjects = body["subjects"]
        assert set(subjects.keys()) == {
            "Mathematics", "Science", "Social Science", "English",
        }
        # 50 total chapters
        total = sum(len(v) for v in subjects.values())
        assert total == 50, f"expected 50 chapters, got {total}"
        assert body["total_topics"] == 50
        # First Math chapter is Real Numbers (used for Next Action card test)
        assert subjects["Mathematics"][0] == "Real Numbers"

    def test_unknown_country_404(self):
        r = requests.get(
            f"{API}/syllabus/national",
            params={"country": "Atlantis", "class_level": "10"},
            timeout=10,
        )
        assert r.status_code == 404


# ─── auth profile shape ────────────────────────────────────────────────────
class TestUserProfile:
    def test_login_returns_full_profile(self):
        r = requests.post(
            f"{API}/auth/login",
            json={"email": shared["email"], "password": shared["password"]},
            timeout=15,
        )
        assert r.status_code == 200
        u = r.json()["user"]
        for k in [
            "country", "class_level", "syllabus_source", "syllabus_name", "onboarded",
        ]:
            assert k in u, f"missing {k} in /auth/login user payload"
        assert u["onboarded"] is False

    def test_me_returns_full_profile(self):
        r = requests.get(f"{API}/auth/me", headers=shared["headers"], timeout=10)
        assert r.status_code == 200
        u = r.json()
        for k in ["country", "class_level", "syllabus_source", "syllabus_name", "onboarded"]:
            assert k in u

    def test_profile_update(self):
        r = requests.put(
            f"{API}/profile",
            headers=_h_json(),
            json={"country": "India", "class_level": "10"},
            timeout=10,
        )
        assert r.status_code == 200
        u = r.json()
        assert u["country"] == "India"
        assert u["class_level"] == "10"


# ─── apply-national + topics propagation ───────────────────────────────────
class TestApplyNational:
    def test_apply_national_replaces_topics_and_onboards(self):
        r = requests.post(
            f"{API}/syllabus/apply-national",
            headers=_h_json(),
            json={"country": "India", "class_level": "10"},
            timeout=20,
        )
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        u = r.json()
        assert u["onboarded"] is True
        assert u["syllabus_source"] == "national"
        assert u["syllabus_name"] == "CBSE NCERT"
        assert u["country"] == "India"
        assert u["class_level"] == "10"

        # GET /api/topics returns ~50 topics with the 4 subject domains
        rt = requests.get(f"{API}/topics", headers=shared["headers"], timeout=10)
        assert rt.status_code == 200
        topics = rt.json()
        assert len(topics) == 50, f"expected 50 topics, got {len(topics)}"
        domains = {t["domain"] for t in topics}
        assert domains == {"Mathematics", "Science", "Social Science", "English"}
        # all start at mastery 25 per layout helper
        assert all(t["mastery"] == 25 for t in topics)
        # x/y must be in [0,1]
        for t in topics:
            assert 0 <= t["x"] <= 1 and 0 <= t["y"] <= 1
        # Real Numbers must exist (first Math chapter → expected lowest-mastery
        # tie winner for "Next Action" UI card)
        names = [t["name"] for t in topics]
        assert "Real Numbers" in names

    def test_session_works_with_syllabus_topic(self):
        rt = requests.get(f"{API}/topics", headers=shared["headers"], timeout=10)
        topic = next(t for t in rt.json() if t["name"] == "Real Numbers")
        rs = requests.post(
            f"{API}/sessions/start",
            headers=_h_json(),
            json={"topic_id": topic["id"], "duration_minutes": 15},
            timeout=10,
        )
        assert rs.status_code == 200
        sess = rs.json()
        assert sess["topic_name"] == "Real Numbers"
        # struggle update
        ru = requests.post(
            f"{API}/sessions/{sess['id']}/struggle",
            headers=_h_json(),
            json={"struggle_score": 60},
            timeout=10,
        )
        assert ru.status_code == 200 and ru.json()["struggle_score"] == 60
        # end session
        re = requests.post(
            f"{API}/sessions/{sess['id']}/end",
            headers=_h_json(),
            json={"mastery_delta": 4},
            timeout=10,
        )
        assert re.status_code == 200


# ─── /syllabus/upload (text path — invokes Claude) ─────────────────────────
class TestSyllabusUpload:
    @pytest.fixture(scope="class")
    def upload_user(self):
        """Separate user so we don't disturb the apply-national user state."""
        email = f"test_{uuid.uuid4().hex[:10]}@example.com"
        password = "test-pass-1234"
        r = requests.post(
            f"{API}/auth/signup",
            json={"email": email, "password": password, "name": "Up Tester"},
            timeout=20,
        )
        assert r.status_code == 200
        return {
            "headers": {"Authorization": f"Bearer {r.json()['token']}"},
            "email": email,
        }

    def test_upload_text_paste(self, upload_user):
        text = (
            "Subject A: chapter 1, chapter 2, chapter 3, chapter 4.\n"
            "Subject B: foundations, methods, applications, advanced topics.\n"
            "Subject C: alpha, beta, gamma, delta."
        )
        r = requests.post(
            f"{API}/syllabus/upload",
            headers=upload_user["headers"],
            data={"text": text, "syllabus_name": "MyCustom"},
            timeout=120,  # Claude latency
        )
        assert r.status_code == 200, f"upload failed: {r.status_code} {r.text}"
        u = r.json()
        assert u["onboarded"] is True
        assert u["syllabus_source"] == "uploaded"
        assert u["syllabus_name"] == "MyCustom"

        # topics should be created
        rt = requests.get(f"{API}/topics", headers=upload_user["headers"], timeout=10)
        topics = rt.json()
        assert len(topics) >= 6  # at least a few subjects' worth
        domains = {t["domain"] for t in topics}
        assert len(domains) >= 1

    def test_upload_file_text(self, upload_user):
        """Upload a .txt file (utf-8 decoded path)."""
        text = (
            "Mathematics: Algebra, Calculus, Linear Algebra.\n"
            "Physics: Mechanics, Optics, Thermodynamics."
        )
        files = {"file": ("syllabus.txt", io.BytesIO(text.encode()), "text/plain")}
        r = requests.post(
            f"{API}/syllabus/upload",
            headers=upload_user["headers"],
            files=files,
            timeout=120,
        )
        assert r.status_code == 200, f"file upload failed: {r.status_code} {r.text}"
        u = r.json()
        assert u["syllabus_source"] == "uploaded"
        assert u["syllabus_name"] == "syllabus.txt"

    def test_upload_empty_400(self, upload_user):
        r = requests.post(
            f"{API}/syllabus/upload",
            headers=upload_user["headers"],
            data={"text": ""},
            timeout=15,
        )
        # No text + no file → 400
        assert r.status_code == 400


# ─── /syllabus/skip ────────────────────────────────────────────────────────
class TestSyllabusSkip:
    def test_skip_seeds_default_topics(self):
        email = f"test_{uuid.uuid4().hex[:10]}@example.com"
        s = requests.post(
            f"{API}/auth/signup",
            json={"email": email, "password": "test-pass-1234", "name": "Skipper"},
            timeout=20,
        ).json()
        h = {"Authorization": f"Bearer {s['token']}"}
        r = requests.post(f"{API}/syllabus/skip", headers=h, timeout=15)
        assert r.status_code == 200
        u = r.json()
        assert u["onboarded"] is True
        assert u["syllabus_source"] == "default"
        rt = requests.get(f"{API}/topics", headers=h, timeout=10)
        topics = rt.json()
        assert len(topics) == 10  # default sample seed
