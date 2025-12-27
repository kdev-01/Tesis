from __future__ import annotations
from datetime import datetime



from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.security import PasswordResetToken


async def create_token(
    session: AsyncSession,
    *,
    usuario_id: int,
    token: str,
    expiracion: datetime,
) -> PasswordResetToken:
    entity = PasswordResetToken(usuario_id=usuario_id, token=token, expiracion=expiracion)
    session.add(entity)
    await session.flush()
    return entity


async def get_by_token(session: AsyncSession, token: str) -> PasswordResetToken | None:
    result = await session.execute(select(PasswordResetToken).where(PasswordResetToken.token == token))
    return result.scalar_one_or_none()


async def invalidate_existing(session: AsyncSession, usuario_id: int) -> None:
    result = await session.execute(
        select(PasswordResetToken).where(PasswordResetToken.usuario_id == usuario_id, PasswordResetToken.utilizado.is_(False))
    )
    for token in result.scalars():
        token.utilizado = True
    await session.flush()


async def mark_used(session: AsyncSession, token: PasswordResetToken) -> None:
    token.utilizado = True
    await session.flush()


async def purge_expired(session: AsyncSession, *, before: datetime) -> int:
    result = await session.execute(
        select(PasswordResetToken).where(PasswordResetToken.expiracion < before)
    )
    tokens = result.scalars().all()
    count = 0
    for token in tokens:
        await session.delete(token)
        count += 1
    if tokens:
        await session.flush()
    return count
