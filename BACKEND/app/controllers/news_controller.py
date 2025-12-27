from __future__ import annotations

from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.services import data_service
from app.schemas.news import News, NewsCreate, NewsStateUpdate, NewsUpdate


async def list_public_news(
    session: AsyncSession,
    *,
    page: int,
    page_size: int,
    search: str | None = None,
    categoria: str | None = None,
    destacado: bool | None = None,
    tags: list[str] | None = None,
    fecha_desde: datetime | None = None,
    fecha_hasta: datetime | None = None,
    order_by: str | None = None,
) -> tuple[list[News], int, dict]:
    return await data_service.list_public_news(
        session,
        page=page,
        page_size=page_size,
        search=search,
        categoria=categoria,
        destacado=destacado,
        tags=tags,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        order_by=order_by,
    )


async def list_manage_news(
    session: AsyncSession,
    *,
    page: int,
    page_size: int,
    search: str | None = None,
    estados: list[str] | None = None,
    categoria: str | None = None,
    destacado: bool | None = None,
    tags: list[str] | None = None,
    autor_ids: list[int] | None = None,
    fecha_desde: datetime | None = None,
    fecha_hasta: datetime | None = None,
    order_by: str | None = None,
    order_desc: bool = True,
) -> tuple[list[News], int, dict]:
    return await data_service.list_manage_news(
        session,
        page=page,
        page_size=page_size,
        search=search,
        estados=estados,
        categoria=categoria,
        destacado=destacado,
        tags=tags,
        autor_ids=autor_ids,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        order_by=order_by,
        order_desc=order_desc,
    )


async def create_news(
    session: AsyncSession,
    *,
    autor_id: int,
    payload: NewsCreate,
) -> News:
    return await data_service.create_news(session, autor_id=autor_id, payload=payload)


async def update_news(
    session: AsyncSession,
    *,
    news_id: int,
    payload: NewsUpdate,
) -> News:
    return await data_service.update_news(session, news_id=news_id, payload=payload)


async def change_news_state(
    session: AsyncSession,
    *,
    news_id: int,
    payload: NewsStateUpdate,
) -> News:
    return await data_service.change_news_state(session, news_id=news_id, payload=payload)


async def delete_news(session: AsyncSession, *, news_id: int) -> None:
    await data_service.delete_news(session, news_id=news_id)


async def get_public_news(session: AsyncSession, *, slug: str) -> News:
    return await data_service.get_public_news(session, slug=slug)


async def get_manage_news(session: AsyncSession, *, news_id: int) -> News:
    return await data_service.get_manage_news(session, news_id=news_id)
