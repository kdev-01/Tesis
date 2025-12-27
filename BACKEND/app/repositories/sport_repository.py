from __future__ import annotations

from typing import Iterable, Sequence

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Deporte


async def list_sports(
    session: AsyncSession, *, include_inactive: bool = False
) -> Sequence[Deporte]:
    query = select(Deporte)
    if not include_inactive:
        query = query.where(Deporte.activo.is_(True))
    query = query.order_by(Deporte.nombre.asc())
    result = await session.execute(query)
    return result.scalars().all()


async def get_sport_by_id(
    session: AsyncSession, sport_id: int, *, include_inactive: bool = False
) -> Deporte | None:
    query = select(Deporte).where(Deporte.id == int(sport_id))
    if not include_inactive:
        query = query.where(Deporte.activo.is_(True))
    result = await session.execute(query)
    return result.scalars().first()


async def get_sports_by_ids(
    session: AsyncSession, identifiers: Iterable[int], *, include_inactive: bool = False
) -> Sequence[Deporte]:
    ids = {int(value) for value in identifiers if value is not None}
    if not ids:
        return []
    query = select(Deporte).where(Deporte.id.in_(ids))
    if not include_inactive:
        query = query.where(Deporte.activo.is_(True))
    result = await session.execute(query)
    return result.scalars().all()


async def get_sport_by_name(
    session: AsyncSession, nombre: str, *, include_inactive: bool = True
) -> Deporte | None:
    normalized = (nombre or "").strip().lower()
    if not normalized:
        return None
    query = select(Deporte).where(func.lower(Deporte.nombre) == normalized)
    if not include_inactive:
        query = query.where(Deporte.activo.is_(True))
    result = await session.execute(query)
    return result.scalars().first()


async def create_sport(
    session: AsyncSession, *, nombre: str, activo: bool = True
) -> Deporte:
    sport = Deporte(nombre=nombre, activo=activo)
    session.add(sport)
    await session.flush()
    return sport


async def update_sport(
    session: AsyncSession,
    sport: Deporte,
    *,
    nombre: str | None = None,
    activo: bool | None = None,
) -> Deporte:
    if nombre is not None:
        sport.nombre = nombre
    if activo is not None:
        sport.activo = bool(activo)
    await session.flush()
    return sport
