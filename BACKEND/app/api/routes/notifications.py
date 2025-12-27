from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_roles
from app.controllers import notification_controller
from app.core.database import get_session
from app.schemas.common import Meta, ResponseEnvelope
from app.schemas.notification import (
    Notification,
    NotificationBulkMarkPayload,
    NotificationBulkUpdateResult,
    NotificationClearResult,
    NotificationMarkPayload,
    NotificationSummary,
)
from app.schemas.user import UserBase

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("/", response_model=ResponseEnvelope[list[Notification]])
async def list_notifications(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    status: str | None = Query(None, pattern="^(all|read|unread)?$"),
    search: str | None = Query(None),
    session: AsyncSession = Depends(get_session),
    current_user: UserBase = Depends(require_roles()),
) -> ResponseEnvelope[list[Notification]]:
    normalized_status = None if not status or status == "all" else status
    notifications, total = await notification_controller.list_notifications(
        session,
        usuario_id=current_user.id,
        page=page,
        page_size=page_size,
        status=normalized_status,
        search=search,
    )
    meta = Meta(total=total, page=page, page_size=page_size)
    return ResponseEnvelope(data=notifications, meta=meta)


@router.get("/summary", response_model=ResponseEnvelope[NotificationSummary])
async def get_summary(
    limit: int = Query(5, ge=1, le=50),
    session: AsyncSession = Depends(get_session),
    current_user: UserBase = Depends(require_roles()),
) -> ResponseEnvelope[NotificationSummary]:
    summary = await notification_controller.get_summary(
        session, usuario_id=current_user.id, limit=limit
    )
    return ResponseEnvelope(data=summary)


@router.post(
    "/{notification_id}/read",
    response_model=ResponseEnvelope[Notification],
)
async def mark_notification(
    notification_id: int,
    payload: NotificationMarkPayload,
    session: AsyncSession = Depends(get_session),
    current_user: UserBase = Depends(require_roles()),
) -> ResponseEnvelope[Notification]:
    notification = await notification_controller.mark_notification(
        session,
        notification_id=notification_id,
        usuario_id=current_user.id,
        read=payload.leido,
    )
    return ResponseEnvelope(data=notification)


@router.post(
    "/read-all",
    response_model=ResponseEnvelope[NotificationBulkUpdateResult],
)
async def mark_all_notifications(
    payload: NotificationBulkMarkPayload,
    session: AsyncSession = Depends(get_session),
    current_user: UserBase = Depends(require_roles()),
) -> ResponseEnvelope[NotificationBulkUpdateResult]:
    updated = await notification_controller.mark_all(
        session, usuario_id=current_user.id, read=payload.leido
    )
    return ResponseEnvelope(data=NotificationBulkUpdateResult(actualizadas=updated))


@router.delete(
    "/{notification_id}",
    response_model=ResponseEnvelope[dict],
)
async def delete_notification(
    notification_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: UserBase = Depends(require_roles()),
) -> ResponseEnvelope[dict]:
    await notification_controller.delete_notification(
        session, notification_id=notification_id, usuario_id=current_user.id
    )
    return ResponseEnvelope(data={"message": "Notificación eliminada"})


@router.delete(
    "/",
    response_model=ResponseEnvelope[NotificationClearResult],
)
async def clear_notifications(
    session: AsyncSession = Depends(get_session),
    current_user: UserBase = Depends(require_roles()),
) -> ResponseEnvelope[NotificationClearResult]:
    deleted = await notification_controller.clear_notifications(
        session, usuario_id=current_user.id
    )
    return ResponseEnvelope(data=NotificationClearResult(eliminadas=deleted))
