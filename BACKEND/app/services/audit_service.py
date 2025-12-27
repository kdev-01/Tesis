from __future__ import annotations

from typing import Iterable

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories import audit_repository
from app.schemas.user import UserBase


def _resolve_actor(actor: UserBase | None) -> tuple[int | None, str | None]:
    if actor is None:
        return None, None
    return actor.id, actor.nombre_completo


async def log_event(
    session: AsyncSession,
    *,
    entidad: str,
    accion: str,
    descripcion: str,
    severidad: str = "info",
    metadata: dict | None = None,
    actor: UserBase | None = None,
    entidad_id: int | None = None,
):
    actor_id, actor_nombre = _resolve_actor(actor)
    await audit_repository.create_event(
        session,
        entidad=entidad,
        accion=accion,
        descripcion=descripcion,
        severidad=severidad,
        metadata=metadata or {},
        actor_id=actor_id,
        actor_nombre=actor_nombre,
        entidad_id=entidad_id,
    )


async def list_events(
    session: AsyncSession,
    *,
    page: int,
    page_size: int,
    search: str | None = None,
    entidades: Iterable[str] | None = None,
    severidades: Iterable[str] | None = None,
    order: str = "desc",
):
    return await audit_repository.list_events(
        session,
        page=page,
        page_size=page_size,
        search=search,
        entidades=entidades,
        severidades=severidades,
        order=order,
    )
