from __future__ import annotations

from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_roles
from app.controllers import history_controller
from app.core.database import get_session
from app.schemas.common import Meta, ResponseEnvelope
from app.schemas.history import HistoryFilters, HistoryRecord
from app.schemas.user import UserBase

router = APIRouter(prefix="/history", tags=["history"])


@router.get("/", response_model=ResponseEnvelope[list[HistoryRecord]])
async def get_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    entidad: str | None = Query(None),
    disciplina: str | None = Query(None),
    institucion_id: int | None = Query(None),
    evento_id: int | None = Query(None),
    fecha_inicio: date | None = Query(None),
    fecha_fin: date | None = Query(None),
    search: str | None = Query(None),
    severidad: str | None = Query(None),
    order: Literal["asc", "desc"] = Query("desc"),
    session: AsyncSession = Depends(get_session),
    _: UserBase = Depends(
        require_roles("Administrador", "Representante de comisión", "Representante educativo")
    ),
) -> ResponseEnvelope[list[HistoryRecord]]:
    filters = HistoryFilters(
        entidad=entidad,
        disciplina=disciplina,
        institucion_id=institucion_id,
        evento_id=evento_id,
        fecha_inicio=fecha_inicio,
        fecha_fin=fecha_fin,
        search=search,
        severidad=severidad,
        order=order,
    )
    records, total, extra = await history_controller.get_history(
        session,
        filters=filters,
        page=page,
        page_size=page_size,
    )
    meta = Meta(total=total, page=page, page_size=page_size, extra=extra)
    return ResponseEnvelope(data=records, meta=meta)
