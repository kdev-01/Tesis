import os
from datetime import datetime, timezone
from types import SimpleNamespace

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///tmp/agxport-test.db")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret")
os.environ.setdefault("JWT_REFRESH_SECRET_KEY", "test-refresh-secret")
os.environ.setdefault("ACCESS_TOKEN_EXPIRE_SECONDS", "900")
os.environ.setdefault("REFRESH_TOKEN_EXPIRE_SECONDS", "86400")
os.environ.setdefault("CORS_ALLOW_ORIGINS", "[]")
os.environ.setdefault("SMTP_HOST", "localhost")
os.environ.setdefault("SMTP_PORT", "1025")
os.environ.setdefault("SMTP_USE_TLS", "false")
os.environ.setdefault("SMTP_FROM", "no-reply@example.com")
os.environ.setdefault("PASSWORD_HASH_SCHEME", "argon2id")
os.environ.setdefault("PASSWORD_HASH_MEMORY_COST", "19456")
os.environ.setdefault("PASSWORD_HASH_TIME_COST", "2")
os.environ.setdefault("PASSWORD_HASH_PARALLELISM", "2")

import pytest

from app.core import security
from app.repositories import user_repository
from app.services.auth_service import auth_service


@pytest.fixture
def anyio_backend():
    return "asyncio"


class DummySession:
    async def flush(self) -> None:  # pragma: no cover - trivial
        return None

    async def commit(self) -> None:  # pragma: no cover - trivial
        return None

    def add(self, obj) -> None:  # pragma: no cover - trivial helper
        return None


@pytest.mark.anyio("asyncio")
async def test_login_success(monkeypatch: pytest.MonkeyPatch) -> None:
    hashed = security.hash_password("Secret123!")
    user_id = 1
    now = datetime.now(timezone.utc)
    fake_role = SimpleNamespace(nombre="Administrador", id=2)
    fake_user = SimpleNamespace(
        id=user_id,
        nombre_completo="Admin General",
        email="admin@agxport.com",
        telefono="+57 3010000000",
        activo=True,
        eliminado=False,
        hash_password=hashed,
        roles=[fake_role],
        ultimo_acceso=None,
        creado_en=now,
        actualizado_en=now,
    )

    async def fake_get_user_by_email(session, email):
        return fake_user if email == fake_user.email else None

    monkeypatch.setattr(user_repository, "get_user_by_email", fake_get_user_by_email)

    session = DummySession()
    session_data = await auth_service.login(session, email=fake_user.email, password="Secret123!")

    assert session_data.user.email == fake_user.email
    assert session_data.user.roles == [fake_role.nombre]

    access_payload = security.decode_access_token(session_data.tokens.access_token)
    assert access_payload["sub"] == str(fake_user.id)
    assert "Administrador" in access_payload["roles"]

    refresh_payload = security.decode_refresh_token(session_data.tokens.refresh_token)
    assert refresh_payload["sub"] == str(fake_user.id)
