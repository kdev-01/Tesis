from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.security import UserInvitation


async def create_invitation(
    session: AsyncSession,
    *,
    email: str,
    nombre: str | None,
    rol_id: int,
    token: str,
    expira_en: datetime,
) -> UserInvitation:
    invitation = UserInvitation(
        email=email,
        nombre=nombre,
        rol_id=rol_id,
        token=token,
        expira_en=expira_en,
    )
    session.add(invitation)
    await session.flush()
    return invitation


async def get_by_token(session: AsyncSession, token: str) -> UserInvitation | None:
    result = await session.execute(select(UserInvitation).where(UserInvitation.token == token))
    return result.scalar_one_or_none()


async def mark_accepted(session: AsyncSession, invitation: UserInvitation) -> None:
    invitation.aceptado_en = datetime.now(timezone.utc)
    await session.flush()


async def list_active(session: AsyncSession, *, email: str | None = None) -> list[UserInvitation]:
    query = select(UserInvitation).where(
        UserInvitation.aceptado_en.is_(None),
        UserInvitation.expira_en > func.now(),
    )
    if email:
        query = query.where(func.lower(UserInvitation.email) == func.lower(email))
    result = await session.execute(query.order_by(UserInvitation.creado_en.desc()))
    return result.scalars().all()


async def cancel_invitation(session: AsyncSession, invitation: UserInvitation) -> None:
    await session.delete(invitation)
    await session.flush()
