from __future__ import annotations

from datetime import datetime, timezone
from typing import Iterable, Sequence

from sqlalchemy import Select, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.event import Evento
from app.models.notification import Notificacion


def _base_query() -> Select[tuple[Notificacion]]:
    return select(Notificacion).options(
        selectinload(Notificacion.evento).options(selectinload(Evento.deporte))
    )


async def create_notification(
    session: AsyncSession,
    *,
    usuario_id: int,
    titulo: str,
    mensaje: str | None = None,
    tipo: str = "general",
    nivel: str = "info",
    metadata: dict | None = None,
    evento_id: int | None = None,
) -> Notificacion:
    now = datetime.now(timezone.utc)
    notification = Notificacion(
        usuario_id=usuario_id,
        titulo=titulo,
        mensaje=mensaje,
        tipo=tipo,
        nivel=nivel,
        metadata=metadata or {},
        evento_id=evento_id,
        leido=False,
        leido_en=None,
        eliminado=False,
        eliminado_en=None,
        creado_en=now,
        actualizado_en=now,
    )
    session.add(notification)
    await session.flush()
    await session.refresh(notification)
    return notification


async def list_notifications(
    session: AsyncSession,
    *,
    usuario_id: int,
    page: int,
    page_size: int,
    status: str | None = None,
    search: str | None = None,
) -> tuple[list[Notificacion], int]:
    filters = [Notificacion.usuario_id == usuario_id, Notificacion.eliminado.is_(False)]
    if status == "unread":
        filters.append(Notificacion.leido.is_(False))
    elif status == "read":
        filters.append(Notificacion.leido.is_(True))

    if search:
        like_term = f"%{search.lower()}%"
        filters.append(
            func.lower(Notificacion.titulo).like(like_term)
            | func.lower(func.coalesce(Notificacion.mensaje, "")).like(like_term)
        )

    count_query = select(func.count(Notificacion.id)).where(*filters)
    total_result = await session.execute(count_query)
    total = int(total_result.scalar_one()) if total_result is not None else 0

    query = (
        _base_query()
        .where(*filters)
        .order_by(Notificacion.creado_en.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await session.execute(query)
    notifications = list(result.scalars().all())
    return notifications, total


async def list_recent_notifications(
    session: AsyncSession,
    *,
    usuario_id: int,
    limit: int,
) -> list[Notificacion]:
    query = (
        _base_query()
        .where(
            Notificacion.usuario_id == usuario_id,
            Notificacion.eliminado.is_(False),
        )
        .order_by(Notificacion.creado_en.desc())
        .limit(limit)
    )
    result = await session.execute(query)
    return list(result.scalars().all())


async def count_unread_notifications(
    session: AsyncSession, *, usuario_id: int
) -> int:
    query = select(func.count(Notificacion.id)).where(
        Notificacion.usuario_id == usuario_id,
        Notificacion.eliminado.is_(False),
        Notificacion.leido.is_(False),
    )
    result = await session.execute(query)
    return int(result.scalar_one())


async def get_notification(
    session: AsyncSession, *, notification_id: int, usuario_id: int
) -> Notificacion | None:
    query = _base_query().where(
        Notificacion.id == notification_id,
        Notificacion.usuario_id == usuario_id,
        Notificacion.eliminado.is_(False),
    )
    result = await session.execute(query)
    return result.scalars().first()


async def mark_notification_read(
    session: AsyncSession, notification: Notificacion, *, read: bool
) -> Notificacion:
    now = datetime.now(timezone.utc)
    notification.leido = read
    notification.leido_en = now if read else None
    notification.actualizado_en = now
    await session.flush()
    return notification


async def mark_notifications_read(
    session: AsyncSession,
    *,
    usuario_id: int,
    read: bool,
) -> int:
    now = datetime.now(timezone.utc)
    result = await session.execute(
        update(Notificacion)
        .where(
            Notificacion.usuario_id == usuario_id,
            Notificacion.eliminado.is_(False),
        )
        .values(
            leido=read,
            leido_en=now if read else None,
            actualizado_en=now,
        )
        .returning(Notificacion.id)
    )
    rows: Sequence[int] = result.scalars().all()
    return len(rows)


async def delete_notification(session: AsyncSession, notification: Notificacion) -> None:
    now = datetime.now(timezone.utc)
    notification.eliminado = True
    notification.eliminado_en = now
    notification.actualizado_en = now
    await session.flush()


async def clear_notifications(session: AsyncSession, *, usuario_id: int) -> int:
    now = datetime.now(timezone.utc)
    result = await session.execute(
        update(Notificacion)
        .where(
            Notificacion.usuario_id == usuario_id,
            Notificacion.eliminado.is_(False),
        )
        .values(eliminado=True, eliminado_en=now, actualizado_en=now)
        .returning(Notificacion.id)
    )
    rows: Iterable[int] = result.scalars().all()
    return len(list(rows))
