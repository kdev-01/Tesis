from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ApplicationError
from app.repositories import notification_repository
from app.schemas.notification import (
    Notification,
    NotificationSummary,
)
from app.services.mappers import map_notification


async def list_user_notifications(
    session: AsyncSession,
    *,
    usuario_id: int,
    page: int,
    page_size: int,
    status: str | None = None,
    search: str | None = None,
) -> tuple[list[Notification], int]:
    notifications, total = await notification_repository.list_notifications(
        session,
        usuario_id=usuario_id,
        page=page,
        page_size=page_size,
        status=status,
        search=search,
    )
    return [map_notification(item) for item in notifications], total


async def get_user_summary(
    session: AsyncSession, *, usuario_id: int, limit: int
) -> NotificationSummary:
    recent = await notification_repository.list_recent_notifications(
        session, usuario_id=usuario_id, limit=limit
    )
    total_unread = await notification_repository.count_unread_notifications(
        session, usuario_id=usuario_id
    )
    return NotificationSummary(
        total_sin_leer=total_unread,
        recientes=[map_notification(item) for item in recent],
    )


async def mark_notification_read(
    session: AsyncSession,
    *,
    notification_id: int,
    usuario_id: int,
    read: bool,
) -> Notification:
    notification = await notification_repository.get_notification(
        session, notification_id=notification_id, usuario_id=usuario_id
    )
    if not notification:
        raise ApplicationError("Notificación no encontrada", status_code=404)
    updated = await notification_repository.mark_notification_read(
        session, notification, read=read
    )
    await session.commit()
    await session.refresh(updated)
    return map_notification(updated)


async def mark_all_notifications(
    session: AsyncSession, *, usuario_id: int, read: bool
) -> int:
    affected = await notification_repository.mark_notifications_read(
        session, usuario_id=usuario_id, read=read
    )
    await session.commit()
    return affected


async def delete_notification(
    session: AsyncSession, *, notification_id: int, usuario_id: int
) -> None:
    notification = await notification_repository.get_notification(
        session, notification_id=notification_id, usuario_id=usuario_id
    )
    if not notification:
        raise ApplicationError("Notificación no encontrada", status_code=404)
    await notification_repository.delete_notification(session, notification)
    await session.commit()


async def clear_notifications(session: AsyncSession, *, usuario_id: int) -> int:
    deleted = await notification_repository.clear_notifications(
        session, usuario_id=usuario_id
    )
    await session.commit()
    return deleted
