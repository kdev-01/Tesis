from __future__ import annotations

from typing import Iterable, Tuple

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AppEventLog


async def create_event(
    session: AsyncSession,
    *,
    entidad: str,
    accion: str,
    descripcion: str,
    severidad: str = "info",
    metadata: dict | None = None,
    actor_id: int | None = None,
    actor_nombre: str | None = None,
    entidad_id: int | None = None,
) -> AppEventLog:
    log = AppEventLog(
        entidad=entidad,
        accion=accion,
        descripcion=descripcion,
        severidad=severidad,
        metadata=metadata or {},
        actor_id=actor_id,
        actor_nombre=actor_nombre,
        entidad_id=entidad_id,
    )
    session.add(log)
    await session.flush()
    return log


async def list_events(
    session: AsyncSession,
    *,
    page: int,
    page_size: int,
    search: str | None = None,
    entidades: Iterable[str] | None = None,
    severidades: Iterable[str] | None = None,
    order: str = "desc",
) -> Tuple[list[AppEventLog], int]:
    query: Select[tuple[AppEventLog]] = select(AppEventLog)
    if search:
        like_term = f"%{search.lower()}%"
        query = query.where(
            func.lower(AppEventLog.descripcion).like(like_term)
            | func.lower(AppEventLog.accion).like(like_term)
            | func.lower(AppEventLog.entidad).like(like_term)
        )
    if entidades:
        normalized = [item.strip().lower() for item in entidades if item]
        if normalized:
            query = query.where(func.lower(AppEventLog.entidad).in_(normalized))
    if severidades:
        normalized_severities = [item.strip().lower() for item in severidades if item]
        if normalized_severities:
            query = query.where(func.lower(AppEventLog.severidad).in_(normalized_severities))

    count_query = select(func.count()).select_from(query.subquery())
    total = (await session.execute(count_query)).scalar_one()

    order_clause = AppEventLog.registrado_en.asc()
    if str(order).lower() != "asc":
        order_clause = AppEventLog.registrado_en.desc()

    result = await session.execute(
        query.order_by(order_clause).offset((page - 1) * page_size).limit(page_size)
    )
    return list(result.scalars().all()), total
