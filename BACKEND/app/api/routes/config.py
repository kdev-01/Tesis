from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_roles
from app.controllers import config_controller
from app.core.database import get_session
from app.schemas.common import ResponseEnvelope
from app.schemas.configuration import AppConfigSchema, UpdateAppConfigRequest
from app.schemas.catalog import (
    CategoryConfig,
    CategoryCreateRequest,
    CategoryUpdateRequest,
    SportConfig,
    SportCreateRequest,
    SportUpdateRequest,
)
from app.schemas.user import UserBase

router = APIRouter(prefix="/config", tags=["config"])


@router.get("/public", response_model=ResponseEnvelope[AppConfigSchema | dict])
async def get_public_config(
    session: AsyncSession = Depends(get_session),
) -> ResponseEnvelope[AppConfigSchema | dict]:
    settings = await config_controller.get_settings(session)
    if not settings:
        return ResponseEnvelope(data={})
    return ResponseEnvelope(data=settings)


@router.get("/", response_model=ResponseEnvelope[AppConfigSchema | dict])
async def get_config(
    session: AsyncSession = Depends(get_session),
    _: UserBase = Depends(require_roles("Administrador", "Representante de comisión")),
) -> ResponseEnvelope[AppConfigSchema | dict]:
    settings = await config_controller.get_settings(session)
    if not settings:
        return ResponseEnvelope(data={})
    return ResponseEnvelope(data=settings)


@router.put("/", response_model=ResponseEnvelope[AppConfigSchema])
async def update_config(
    payload: UpdateAppConfigRequest,
    session: AsyncSession = Depends(get_session),
    _: UserBase = Depends(require_roles("Administrador", "Representante de comisión")),
) -> ResponseEnvelope[AppConfigSchema]:
    updated = await config_controller.update_settings(
        session,
        branding_name=payload.branding_name,
        support_email=payload.support_email,
        maintenance_mode=payload.maintenance_mode,
    )
    return ResponseEnvelope(data=updated)


@router.get(
    "/sports/", response_model=ResponseEnvelope[list[SportConfig]]
)
async def list_sports(
    session: AsyncSession = Depends(get_session),
    _: UserBase = Depends(require_roles("Administrador", "Representante de comisión")),
) -> ResponseEnvelope[list[SportConfig]]:
    sports = await config_controller.list_sports(session)
    return ResponseEnvelope(data=sports)


@router.post("/sports/", response_model=ResponseEnvelope[SportConfig])
async def create_sport(
    payload: SportCreateRequest,
    session: AsyncSession = Depends(get_session),
    _: UserBase = Depends(require_roles("Administrador", "Representante de comisión")),
) -> ResponseEnvelope[SportConfig]:
    sport = await config_controller.create_sport(session, payload)
    return ResponseEnvelope(data=sport)


@router.put("/sports/{sport_id}", response_model=ResponseEnvelope[SportConfig])
async def update_sport(
    sport_id: int,
    payload: SportUpdateRequest,
    session: AsyncSession = Depends(get_session),
    _: UserBase = Depends(require_roles("Administrador", "Representante de comisión")),
) -> ResponseEnvelope[SportConfig]:
    sport = await config_controller.update_sport(session, sport_id, payload)
    return ResponseEnvelope(data=sport)


@router.get(
    "/categories/",
    response_model=ResponseEnvelope[list[CategoryConfig]],
)
async def list_categories(
    deporte_id: int | None = Query(None),
    session: AsyncSession = Depends(get_session),
    _: UserBase = Depends(require_roles("Administrador", "Representante de comisión")),
) -> ResponseEnvelope[list[CategoryConfig]]:
    categories = await config_controller.list_categories(
        session, deporte_id=deporte_id
    )
    return ResponseEnvelope(data=categories)


@router.post("/categories/", response_model=ResponseEnvelope[CategoryConfig])
async def create_category(
    payload: CategoryCreateRequest,
    session: AsyncSession = Depends(get_session),
    _: UserBase = Depends(require_roles("Administrador", "Representante de comisión")),
) -> ResponseEnvelope[CategoryConfig]:
    category = await config_controller.create_category(session, payload)
    return ResponseEnvelope(data=category)


@router.put(
    "/categories/{category_id}",
    response_model=ResponseEnvelope[CategoryConfig],
)
async def update_category(
    category_id: int,
    payload: CategoryUpdateRequest,
    session: AsyncSession = Depends(get_session),
    _: UserBase = Depends(require_roles("Administrador", "Representante de comisión")),
) -> ResponseEnvelope[CategoryConfig]:
    category = await config_controller.update_category(
        session, category_id, payload
    )
    return ResponseEnvelope(data=category)
