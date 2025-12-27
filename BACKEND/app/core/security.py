from __future__ import annotations
from datetime import datetime, timedelta, timezone
from typing import Any, Dict

try:  # pragma: no cover - import guard
    import jwt  # type: ignore
    InvalidTokenError = jwt.InvalidTokenError  # type: ignore[attr-defined]
except ModuleNotFoundError:  # pragma: no cover - fallback for missing PyJWT
    from jose import JWTError as InvalidTokenError  # type: ignore[attr-defined]
    from jose import jwt  # type: ignore
from passlib.context import CryptContext
from passlib.exc import UnknownHashError

from .config import settings


def _build_password_context() -> CryptContext:
    scheme = settings.password_hash_scheme.lower()
    if scheme != "argon2id":
        raise RuntimeError(
            "Configuración de hashing inválida: PASSWORD_HASH_SCHEME debe ser 'argon2id'."
        )
    return CryptContext(
        schemes=["argon2"],
        deprecated="auto",
        argon2__type="ID",
        argon2__memory_cost=settings.password_hash_memory_cost,
        argon2__time_cost=settings.password_hash_time_cost,
        argon2__parallelism=settings.password_hash_parallelism,
    )


pwd_context = _build_password_context()


def verify_password(plain_password: str, hashed_password: str | None) -> bool:
    if not hashed_password:
        return False
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except UnknownHashError:
        return False


def hash_password(password: str) -> str:
    return pwd_context.hash(password)



# app/core/security.py
from datetime import datetime, timedelta, timezone

def create_access_token(subject: Dict[str, Any], expires_delta: int | None = None) -> str:
    now = datetime.now(timezone.utc)
    expire = now + timedelta(seconds=expires_delta or settings.access_token_expire_seconds)
    payload = {
        **subject,
        "type": "access",
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm="HS256")

def create_refresh_token(subject: Dict[str, Any], expires_delta: int | None = None) -> str:
    now = datetime.now(timezone.utc)
    expire = now + timedelta(seconds=expires_delta or settings.refresh_token_expire_seconds)
    payload = {
        **subject,
        "type": "refresh",
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    return jwt.encode(payload, settings.jwt_refresh_secret_key, algorithm="HS256")


def decode_access_token(token: str) -> Dict[str, Any]:
    payload = jwt.decode(token, settings.jwt_secret_key, algorithms=["HS256"])
    if payload.get("type") != "access":
        raise InvalidTokenError("Tipo de token inválido")
    return payload


def decode_refresh_token(token: str) -> Dict[str, Any]:
    payload = jwt.decode(token, settings.jwt_refresh_secret_key, algorithms=["HS256"])
    if payload.get("type") != "refresh":
        raise InvalidTokenError("Tipo de token inválido")
    return payload
