from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.notification import Notification, NotificationSummary
from app.services import notification_service


async def list_notifications(
    session: AsyncSession,
    *,
    usuario_id: int,
    page: int,
    page_size: int,
    status: str | None = None,
    search: str | None = None,
) -> tuple[list[Notification], int]:
    return await notification_service.list_user_notifications(
        session,
        usuario_id=usuario_id,
        page=page,
        page_size=page_size,
        status=status,
        search=search,
    )


async def get_summary(
    session: AsyncSession, *, usuario_id: int, limit: int
) -> NotificationSummary:
    return await notification_service.get_user_summary(
        session, usuario_id=usuario_id, limit=limit
    )


async def mark_notification(
    session: AsyncSession,
    *,
    notification_id: int,
    usuario_id: int,
    read: bool,
) -> Notification:
    return await notification_service.mark_notification_read(
        session,
        notification_id=notification_id,
        usuario_id=usuario_id,
        read=read,
    )


async def mark_all(
    session: AsyncSession, *, usuario_id: int, read: bool
) -> int:
    return await notification_service.mark_all_notifications(
        session, usuario_id=usuario_id, read=read
    )


async def delete_notification(
    session: AsyncSession, *, notification_id: int, usuario_id: int
) -> None:
    await notification_service.delete_notification(
        session, notification_id=notification_id, usuario_id=usuario_id
    )


async def clear_notifications(session: AsyncSession, *, usuario_id: int) -> int:
    return await notification_service.clear_notifications(
        session, usuario_id=usuario_id
    )
