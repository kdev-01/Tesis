from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    LogoutResponse,
    RefreshRequest,
    ResetPasswordRequest,
    SessionData,
)
from app.schemas.common import ResponseEnvelope
from app.schemas.user import UserBase
from app.services.auth_service import auth_service
from app.services.password_service import password_service
from app.services.email_service import email_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=ResponseEnvelope[SessionData])
async def login(
    payload: LoginRequest,
    session: AsyncSession = Depends(get_session),
) -> ResponseEnvelope[SessionData]:
    session_data = await auth_service.login(session, email=payload.email, password=payload.password)
    asyncio.create_task(
        email_service.send_login_notification(to=session_data.user.email, name=session_data.user.nombre_completo)
    )
    return ResponseEnvelope(data=session_data)


@router.post("/logout", response_model=ResponseEnvelope[LogoutResponse])
async def logout() -> ResponseEnvelope[LogoutResponse]:
    return ResponseEnvelope(data=LogoutResponse(message="Sesión finalizada"))


@router.post("/refresh", response_model=ResponseEnvelope[SessionData])
async def refresh(
    payload: RefreshRequest,
    session: AsyncSession = Depends(get_session),
) -> ResponseEnvelope[SessionData]:
    session_data = await auth_service.refresh_session(session, refresh_token=payload.refresh_token)
    return ResponseEnvelope(data=session_data)


@router.get("/me", response_model=ResponseEnvelope[UserBase])
async def me(
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> ResponseEnvelope[UserBase]:
    auth_header = request.headers.get("Authorization")
    token = None
    if auth_header and auth_header.lower().startswith("bearer "):
        token = auth_header.split(" ", 1)[1].strip()
    user = await auth_service.resolve_user_from_access_token(session, token=token)
    return ResponseEnvelope(data=user)


@router.post("/forgot-password", response_model=ResponseEnvelope[dict])
async def forgot_password(
    payload: ForgotPasswordRequest,
    session: AsyncSession = Depends(get_session),
) -> ResponseEnvelope[dict]:
    await password_service.request_reset(session, email=payload.email)
    return ResponseEnvelope(data={"message": "Si el correo existe, enviaremos un enlace de recuperación."})


@router.post("/reset-password", response_model=ResponseEnvelope[dict])
async def reset_password(
    payload: ResetPasswordRequest,
    session: AsyncSession = Depends(get_session),
) -> ResponseEnvelope[dict]:
    await password_service.reset_password(session, token=payload.token, new_password=payload.password)
    return ResponseEnvelope(data={"message": "Tu contraseña se actualizó correctamente"})
