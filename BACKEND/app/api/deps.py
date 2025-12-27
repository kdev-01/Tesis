from __future__ import annotations

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.exceptions import ApplicationError, ForbiddenError, UnauthorizedError
from app.schemas.user import UserBase
from app.services.auth_service import auth_service


async def get_current_user(
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> UserBase:
    auth_header = request.headers.get("Authorization")
    token: str | None = None
    if auth_header and auth_header.lower().startswith("bearer "):
        token = auth_header.split(" ", 1)[1].strip()
    return await auth_service.resolve_user_from_access_token(session, token=token)


async def get_optional_user(
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> UserBase | None:
    auth_header = request.headers.get("Authorization")
    token: str | None = None
    if auth_header and auth_header.lower().startswith("bearer "):
        token = auth_header.split(" ", 1)[1].strip()
    if not token:
        return None
    try:
        return await auth_service.resolve_user_from_access_token(session, token=token)
    except (UnauthorizedError, ApplicationError):
        return None


def require_roles(*roles: str):
    async def role_dependency(user: UserBase = Depends(get_current_user)) -> UserBase:
        if not roles:
            return user
        if not any(role in user.roles for role in roles):
            raise ForbiddenError()
        return user

    return role_dependency
