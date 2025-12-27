from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_roles
from app.controllers import news_controller
from app.core.database import get_session
from app.schemas.common import Meta, ResponseEnvelope
from app.schemas.news import News, NewsCreate, NewsStateUpdate, NewsUpdate
from app.schemas.user import UserBase

router = APIRouter(prefix="/news", tags=["news"])


def _split_tags(raw: str | None) -> list[str] | None:
    if raw is None:
        return None
    tags = [item.strip() for item in raw.split(",") if item.strip()]
    return tags or None


def _split_states(raw: str | None) -> list[str] | None:
    if raw is None:
        return None
    states = [item.strip() for item in raw.split(",") if item.strip()]
    return states or None


@router.get("/", response_model=ResponseEnvelope[list[News]])
async def list_public_news(
    page: int = Query(1, ge=1),
    page_size: int = Query(9, ge=1, le=100),
    search: str | None = Query(None),
    categoria: str | None = Query(None),
    tags: str | None = Query(None, description="Lista separada por comas"),
    destacado: bool | None = Query(None),
    fecha_desde: datetime | None = Query(None),
    fecha_hasta: datetime | None = Query(None),
    order_by: str | None = Query(None, pattern=r"^(fecha_publicacion|creado_en|orden)$"),
    session: AsyncSession = Depends(get_session),
) -> ResponseEnvelope[list[News]]:
    noticias, total, extra = await news_controller.list_public_news(
        session,
        page=page,
        page_size=page_size,
        search=search,
        categoria=categoria,
        destacado=destacado,
        tags=_split_tags(tags),
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        order_by=order_by,
    )
    meta = Meta(total=total, page=page, page_size=page_size, extra=extra)
    return ResponseEnvelope(data=noticias, meta=meta)


@router.get("/manage/", response_model=ResponseEnvelope[list[News]])
async def list_manage_news(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    search: str | None = Query(None),
    estados: str | None = Query(None, description="Valores separados por comas"),
    categoria: str | None = Query(None),
    destacado: bool | None = Query(None),
    tags: str | None = Query(None, description="Lista separada por comas"),
    autor_id: int | None = Query(None),
    fecha_desde: datetime | None = Query(None),
    fecha_hasta: datetime | None = Query(None),
    order_by: str | None = Query(None, pattern=r"^(fecha_publicacion|creado_en|orden)$"),
    order: str | None = Query("desc", pattern=r"^(asc|desc)$"),
    session: AsyncSession = Depends(get_session),
    user: UserBase = Depends(require_roles("Administrador", "Representante de comisión")),
) -> ResponseEnvelope[list[News]]:
    order_desc = (order or "desc").lower() != "asc"
    noticias, total, extra = await news_controller.list_manage_news(
        session,
        page=page,
        page_size=page_size,
        search=search,
        estados=_split_states(estados),
        categoria=categoria,
        destacado=destacado,
        tags=_split_tags(tags),
        autor_ids=[autor_id] if autor_id else None,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        order_by=order_by,
        order_desc=order_desc,
    )
    meta = Meta(total=total, page=page, page_size=page_size, extra=extra)
    return ResponseEnvelope(data=noticias, meta=meta)


@router.get("/manage/{news_id}", response_model=ResponseEnvelope[News])
async def get_manage_news(
    news_id: int,
    session: AsyncSession = Depends(get_session),
    user: UserBase = Depends(require_roles("Administrador", "Representante de comisión")),
) -> ResponseEnvelope[News]:
    noticia = await news_controller.get_manage_news(session, news_id=news_id)
    return ResponseEnvelope(data=noticia)


@router.post(
    "/manage/",
    response_model=ResponseEnvelope[News],
    status_code=status.HTTP_201_CREATED,
)
async def create_news(
    payload: NewsCreate,
    session: AsyncSession = Depends(get_session),
    user: UserBase = Depends(require_roles("Administrador", "Representante de comisión")),
) -> ResponseEnvelope[News]:
    noticia = await news_controller.create_news(session, autor_id=user.id, payload=payload)
    return ResponseEnvelope(data=noticia)


@router.put("/manage/{news_id}", response_model=ResponseEnvelope[News])
async def update_news(
    news_id: int,
    payload: NewsUpdate,
    session: AsyncSession = Depends(get_session),
    user: UserBase = Depends(require_roles("Administrador", "Representante de comisión")),
) -> ResponseEnvelope[News]:
    noticia = await news_controller.update_news(session, news_id=news_id, payload=payload)
    return ResponseEnvelope(data=noticia)


@router.patch("/manage/{news_id}/state", response_model=ResponseEnvelope[News])
async def change_news_state(
    news_id: int,
    payload: NewsStateUpdate,
    session: AsyncSession = Depends(get_session),
    user: UserBase = Depends(require_roles("Administrador", "Representante de comisión")),
) -> ResponseEnvelope[News]:
    noticia = await news_controller.change_news_state(session, news_id=news_id, payload=payload)
    return ResponseEnvelope(data=noticia)




@router.get("/{slug}", response_model=ResponseEnvelope[News])
async def get_public_news(
    slug: str,
    session: AsyncSession = Depends(get_session),
) -> ResponseEnvelope[News]:
    noticia = await news_controller.get_public_news(session, slug=slug)
    return ResponseEnvelope(data=noticia)
