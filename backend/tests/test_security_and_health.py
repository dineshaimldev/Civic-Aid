import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import app
from app.services.reminder_service import ReminderService
from app.services.vault_service import DocumentVaultService
from app.services.persistence_service import get_persistence


def test_health_endpoint_reports_configured_services():
    response = TestClient(app).get("/api/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["services"]["rag"].startswith("ok (")
    assert "X-Request-ID" in response.headers
    assert response.headers["X-Content-Type-Options"] == "nosniff"


def test_cors_allows_vault_token_header():
    response = TestClient(app).options(
        "/api/vault/9876543210",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "X-Vault-Token",
        },
    )

    assert response.status_code == 200
    assert "x-vault-token" in response.headers["access-control-allow-headers"].lower()


def test_cors_allows_reminder_token_header():
    response = TestClient(app).options(
        "/api/reminders/9876543210",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "X-Reminder-Token",
        },
    )

    assert response.status_code == 200
    assert "x-reminder-token" in response.headers["access-control-allow-headers"].lower()


def test_request_id_rejects_header_injection_characters():
    response = TestClient(app).get(
        "/api/health",
        headers={"X-Request-ID": "bad\r\nX-Injected: yes"},
    )

    assert response.status_code == 200
    assert "\r" not in response.headers["X-Request-ID"]
    assert "\n" not in response.headers["X-Request-ID"]


def test_vault_access_token_is_required_and_encryption_round_trips():
    service = DocumentVaultService()
    phone = "9876543210"
    token = service.issue_access_token(phone)

    assert service.verify_access_token(phone, token)
    assert not service.verify_access_token(phone, "wrong-token")

    meta = service.upload_document(
        phone=phone,
        title="patta.pdf",
        doc_type="patta",
        file_bytes=b"sensitive document",
        content_type="application/pdf",
    )
    stored = service.get_document(phone, meta["id"])

    assert stored is not None
    assert stored[1] == b"sensitive document"


def test_sensitive_record_repository_round_trips_records():
    repository = get_persistence()
    repository.save_record(
        "test_record",
        "record-1",
        {"value": "durable"},
        "2099-01-01T00:00:00",
    )

    assert repository.get_record("test_record", "record-1") == {"value": "durable"}
    assert repository.list_records("test_record") == [{"value": "durable"}]


def test_reminder_access_token_is_required_for_listing():
    service = ReminderService()
    phone = "9876543" + "210"
    created = service.create_reminder(
        phone=phone,
        title="Patta objection",
        deadline_date="2099-01-01",
    )

    assert created["access_token"]
    assert service.verify_access_token(phone, created["access_token"])
    assert not service.verify_access_token(phone, "wrong-token")
    assert len(service.get_reminders_for_phone(phone)) >= 1
    assert "access_token" not in service.get_reminders_for_phone(phone)[0]


def test_reminder_api_returns_token_and_blocks_unauthorized_listing():
    client = TestClient(app)
    phone = "9123456789"
    created = client.post(
        "/api/reminders",
        json={
            "phone": phone,
            "title": "Court date",
            "deadline_date": "2099-01-01",
        },
    )

    assert created.status_code == 200
    token = created.json()["access_token"]
    assert token
    assert client.get(f"/api/reminders/{phone}").status_code == 401

    listed = client.get(
        f"/api/reminders/{phone}",
        headers={"X-Reminder-Token": token},
    )
    assert listed.status_code == 200
    assert len(listed.json()["reminders"]) >= 1

    takeover = client.post(
        "/api/reminders",
        json={
            "phone": phone,
            "title": "Attempted takeover",
            "deadline_date": "2099-01-02",
        },
    )
    assert takeover.status_code == 401


def test_production_settings_reject_default_secrets():
    with pytest.raises(ValueError):
        Settings(
            app_env="production",
            app_secret_key="change-this-in-production",
            groq_api_key="configured",
            reminder_sweep_token="x" * 32,
        )


def test_production_settings_require_sweep_token():
    with pytest.raises(ValueError):
        Settings(
            app_env="production",
            app_secret_key="s" * 32,
            groq_api_key="configured",
            reminder_sweep_token="",
        )


def test_production_settings_require_managed_redis():
    with pytest.raises(ValueError):
        Settings(
            app_env="production",
            app_secret_key="s" * 32,
            groq_api_key="configured",
            reminder_sweep_token="t" * 32,
            redis_url="redis://localhost:6379",
        )


def test_admin_endpoints_reject_missing_token():
    client = TestClient(app)

    sweep = client.post("/api/reminders/sweep/run")
    stats = client.get("/api/corruption-report/stats")

    assert sweep.status_code == 401
    assert stats.status_code == 401
