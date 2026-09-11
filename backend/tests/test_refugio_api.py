"""Refúgio da Beleza — backend API tests."""
import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://beauty-booking-467.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def unique_email():
    return f"test_{uuid.uuid4().hex[:8]}@refugio.com"


@pytest.fixture(scope="session")
def registered(unique_email):
    body = {"name": "Ana Teste", "phone": "(19) 99999-8888",
            "email": unique_email, "password": "senha123", "lgpd_accepted": True}
    r = requests.post(f"{API}/auth/register", json=body, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="session")
def token(registered):
    return registered["access_token"]


@pytest.fixture
def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


# ---------- Auth ----------
class TestAuth:
    def test_register_lgpd_false_400(self):
        r = requests.post(f"{API}/auth/register", json={
            "name": "NoLgpd", "phone": "(19) 91111-1111", "email": f"nolgpd_{uuid.uuid4().hex[:6]}@t.com",
            "password": "senha123", "lgpd_accepted": False}, timeout=30)
        assert r.status_code == 400, r.text

    def test_register_ok(self, registered):
        assert "access_token" in registered
        assert registered["user"]["email"]

    def test_register_duplicate_409(self, registered, unique_email):
        r = requests.post(f"{API}/auth/register", json={
            "name": "Dup", "phone": "(19) 91234-5678", "email": unique_email,
            "password": "senha123", "lgpd_accepted": True}, timeout=30)
        assert r.status_code == 409, r.text

    def test_login_wrong_password_401(self, unique_email):
        r = requests.post(f"{API}/auth/login", json={"email": unique_email, "password": "wrong"}, timeout=30)
        assert r.status_code == 401

    def test_login_ok(self, unique_email):
        r = requests.post(f"{API}/auth/login", json={"email": unique_email, "password": "senha123"}, timeout=30)
        assert r.status_code == 200
        assert "access_token" in r.json()

    def test_forgot_always_200(self):
        r = requests.post(f"{API}/auth/forgot-password", json={"email": "notexists@x.com"}, timeout=30)
        assert r.status_code == 200

    def test_me_requires_bearer(self):
        r = requests.get(f"{API}/auth/me", timeout=30)
        assert r.status_code == 401

    def test_me_ok(self, auth_headers):
        r = requests.get(f"{API}/auth/me", headers=auth_headers, timeout=30)
        assert r.status_code == 200
        assert r.json()["email"]

    def test_patch_me(self, auth_headers):
        r = requests.patch(f"{API}/auth/me", headers=auth_headers, json={"name": "Ana Atualizada"}, timeout=30)
        assert r.status_code == 200
        assert r.json()["name"] == "Ana Atualizada"


# ---------- Catalog ----------
class TestCatalog:
    def test_services_returns_12(self):
        r = requests.get(f"{API}/services", timeout=30)
        assert r.status_code == 200
        assert len(r.json()) == 12

    @pytest.mark.parametrize("cat", ["Cabelo", "Unhas", "Depilação"])
    def test_services_by_category(self, cat):
        r = requests.get(f"{API}/services", params={"category": cat}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert len(data) > 0
        assert all(s["category"] == cat for s in data)

    def test_services_featured(self):
        r = requests.get(f"{API}/services", params={"featured": "true"}, timeout=30)
        assert r.status_code == 200
        assert all(s["featured"] for s in r.json())

    def test_professionals_4(self):
        r = requests.get(f"{API}/professionals", timeout=30)
        assert r.status_code == 200
        assert len(r.json()) == 4


# ---------- Availability & Appointments ----------
def _future_date(days=3):
    return (datetime.now(timezone.utc) + timedelta(days=days)).strftime("%Y-%m-%d")


class TestAvailability:
    def test_20_slots(self):
        r = requests.get(f"{API}/availability", params={"date": _future_date(5)}, timeout=30)
        assert r.status_code == 200
        slots = r.json()["slots"]
        assert len(slots) == 20
        assert slots[0]["time"] == "09:00"
        assert slots[-1]["time"] == "18:30"


class TestAppointments:
    @pytest.fixture(scope="class")
    def service_id(self):
        r = requests.get(f"{API}/services", timeout=30)
        return r.json()[0]["id"]

    @pytest.fixture(scope="class")
    def prof_id(self):
        r = requests.get(f"{API}/professionals", timeout=30)
        return r.json()[0]["id"]

    def test_create_ok(self, auth_headers, service_id, prof_id):
        date = _future_date(3)
        r = requests.post(f"{API}/appointments", headers=auth_headers, json={
            "service_ids": [service_id], "professional_id": prof_id,
            "date": date, "time": "10:00"}, timeout=30)
        assert r.status_code == 200, r.text
        pytest.appt_id = r.json()["id"]
        pytest.appt_date = date

    def test_duplicate_slot_409(self, auth_headers, service_id, prof_id):
        r = requests.post(f"{API}/appointments", headers=auth_headers, json={
            "service_ids": [service_id], "professional_id": prof_id,
            "date": pytest.appt_date, "time": "10:00"}, timeout=30)
        assert r.status_code == 409

    def test_past_400(self, auth_headers, service_id, prof_id):
        past = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
        r = requests.post(f"{API}/appointments", headers=auth_headers, json={
            "service_ids": [service_id], "professional_id": prof_id,
            "date": past, "time": "10:00"}, timeout=30)
        assert r.status_code == 400

    def test_list_upcoming(self, auth_headers):
        r = requests.get(f"{API}/appointments", headers=auth_headers, params={"scope": "upcoming"}, timeout=30)
        assert r.status_code == 200
        assert any(a["id"] == pytest.appt_id for a in r.json())

    def test_reschedule_future(self, auth_headers):
        r = requests.post(f"{API}/appointments/{pytest.appt_id}/reschedule",
                          headers=auth_headers, json={"date": _future_date(4), "time": "11:00"}, timeout=30)
        assert r.status_code == 200

    def test_cancel_future(self, auth_headers):
        r = requests.post(f"{API}/appointments/{pytest.appt_id}/cancel", headers=auth_headers, timeout=30)
        assert r.status_code == 200
        assert r.json()["status"] == "cancelled"

    def test_cancel_within_24h_400(self, auth_headers, service_id, prof_id):
        # Create appointment ~2 hours from now (definitely <24h) - use current UTC hour + 2
        now = datetime.now(timezone.utc)
        target = now + timedelta(hours=2)
        # snap to next 30min boundary
        minute = 0 if target.minute < 30 else 30
        target = target.replace(minute=minute, second=0, microsecond=0)
        date_s = target.strftime("%Y-%m-%d")
        time_s = target.strftime("%H:%M")
        if time_s < "09:00" or time_s > "18:30":
            pytest.skip("outside business hours for <24h test")
        r = requests.post(f"{API}/appointments", headers=auth_headers, json={
            "service_ids": [service_id], "professional_id": prof_id,
            "date": date_s, "time": time_s}, timeout=30)
        if r.status_code != 200:
            pytest.skip(f"could not seed near-term appt: {r.status_code} {r.text}")
        aid = r.json()["id"]
        rc = requests.post(f"{API}/appointments/{aid}/cancel", headers=auth_headers, timeout=30)
        assert rc.status_code == 400, rc.text
