from __future__ import annotations

from datetime import datetime, timezone

import jwt
from fastapi import status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import security
from app.core.config import settings
from app.core.exceptions import ApplicationError, UnauthorizedError
from app.models.user import Usuario
from app.repositories import user_repository
from app.schemas.auth import SessionData, TokenPair
from app.schemas.user import UserBase
from app.services import audit_service
from app.services.mappers import map_user


class AuthService:

    async def authenticate(self, session: AsyncSession, *, email: str, password: str) -> Usuario:
        user = await user_repository.get_user_by_email(session, email)
        if not user or user.eliminado or not security.verify_password(password, user.hash_password):
            raise UnauthorizedError("Credenciales inválidas")
        if not user.activo or user.eliminado:
            raise ApplicationError("El usuario está inactivo", status_code=status.HTTP_403_FORBIDDEN)
        user.ultimo_acceso = datetime.now(timezone.utc)
        await session.flush()
        await session.commit()
        refresh = getattr(session, "refresh", None)
        if callable(refresh):
            await refresh(user)
        return user

    def _create_tokens(self, user: Usuario) -> TokenPair:
        permissions = sorted({perm.permiso for rol in user.roles for perm in getattr(rol, "permisos", [])})
        subject = {
            "sub": str(user.id),
            "roles": [rol.nombre for rol in user.roles],
            "permissions": permissions,
        }
        access_token = security.create_access_token(subject)
        refresh_token = security.create_refresh_token(subject)
        return TokenPair(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=settings.access_token_expire_seconds,
            refresh_expires_in=settings.refresh_token_expire_seconds,
        )

    async def login(self, session: AsyncSession, *, email: str, password: str) -> SessionData:
        user = await self.authenticate(session, email=email, password=password)
        tokens = self._create_tokens(user)
        session_data = SessionData(user=map_user(user), tokens=tokens)
        await audit_service.log_event(
            session,
            entidad="autenticacion",
            accion="login",
            descripcion=f"Inicio de sesión de {session_data.user.nombre_completo}",
            actor=session_data.user,
            entidad_id=session_data.user.id,
            metadata={"email": session_data.user.email},
        )
        await session.commit()
        return session_data

    async def refresh_session(self, session: AsyncSession, *, refresh_token: str | None) -> SessionData:
        if not refresh_token:
            raise UnauthorizedError("Token de sesión inválido")
        try:
            payload = security.decode_refresh_token(refresh_token)
        except jwt.PyJWTError as exc:  # type: ignore[attr-defined]
            raise UnauthorizedError("No se pudo validar el token") from exc

        user_id = payload.get("sub")
        if not user_id:
            raise UnauthorizedError("Token inválido")
        try:
            user_pk = int(user_id)
        except (ValueError, TypeError):
            raise UnauthorizedError("Token inválido")
        user = await session.get(Usuario, user_pk)
        if not user:
            raise UnauthorizedError("Usuario no encontrado")
        if not user.activo or user.eliminado:
            raise ApplicationError("El usuario está inactivo", status_code=status.HTTP_403_FORBIDDEN)

        tokens = self._create_tokens(user)
        return SessionData(user=map_user(user), tokens=tokens)

    async def resolve_user_from_access_token(
        self, session: AsyncSession, *, token: str | None
    ) -> UserBase:
        if not token:
            raise UnauthorizedError("Token de acceso faltante")
        try:
            payload = security.decode_access_token(token)
        except jwt.PyJWTError as exc:  # type: ignore[attr-defined]
            raise UnauthorizedError("Token inválido") from exc

        user_id = payload.get("sub")
        if not user_id:
            raise UnauthorizedError("Token inválido")
        try:
            user_pk = int(user_id)
        except (ValueError, TypeError):
            raise UnauthorizedError("Token inválido")
        user = await session.get(Usuario, user_pk)
        if not user:
            raise UnauthorizedError("Usuario no encontrado")
        if not user.activo or user.eliminado:
            raise ApplicationError("El usuario está inactivo", status_code=status.HTTP_403_FORBIDDEN)

        return map_user(user)


auth_service = AuthService()
