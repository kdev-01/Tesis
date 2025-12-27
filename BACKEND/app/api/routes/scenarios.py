from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_roles
from app.controllers import scenario_controller
from app.core.database import get_session
from app.schemas.common import Meta, ResponseEnvelope
from app.schemas.scenario import Scenario, ScenarioCreate, ScenarioUpdate
from app.schemas.user import UserBase

router = APIRouter(prefix="/scenarios", tags=["scenarios"])


@router.get("/", response_model=ResponseEnvelope[list[Scenario]])
async def list_scenarios(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    search: str | None = Query(None),
    include_inactive: bool = Query(False),
    session: AsyncSession = Depends(get_session),
    _: UserBase = Depends(
        require_roles("Administrador", "Representante de comisión", "Representante educativo")
    ),
) -> ResponseEnvelope[list[Scenario]]:
    scenarios, total = await scenario_controller.list_scenarios(
        session,
        page=page,
        page_size=page_size,
        search=search,
        include_inactive=include_inactive,
    )
    meta = Meta(total=total, page=page, page_size=page_size)
    return ResponseEnvelope(data=scenarios, meta=meta)


@router.post("/", response_model=ResponseEnvelope[Scenario], status_code=status.HTTP_201_CREATED)
async def create_scenario(
    request: Request,
    session: AsyncSession = Depends(get_session),
    _: UserBase = Depends(require_roles("Administrador", "Representante de comisión")),
) -> ResponseEnvelope[Scenario]:
    payload = ScenarioCreate.model_validate(await request.json())
    scenario = await scenario_controller.create_scenario(session, payload)
    return ResponseEnvelope(data=scenario)


@router.put("/{scenario_id}", response_model=ResponseEnvelope[Scenario])
async def update_scenario(
    scenario_id: int,
    request: Request,
    session: AsyncSession = Depends(get_session),
    _: UserBase = Depends(require_roles("Administrador", "Representante de comisión")),
) -> ResponseEnvelope[Scenario]:
    payload = ScenarioUpdate.model_validate(await request.json())
    scenario = await scenario_controller.update_scenario(session, scenario_id, payload)
    return ResponseEnvelope(data=scenario)


@router.delete("/{scenario_id}", response_model=ResponseEnvelope[dict])
async def delete_scenario(
    scenario_id: int,
    session: AsyncSession = Depends(get_session),
    _: UserBase = Depends(require_roles("Administrador", "Representante de comisión")),
) -> ResponseEnvelope[dict]:
    await scenario_controller.delete_scenario(session, scenario_id)
    return ResponseEnvelope(data={"message": "Escenario deshabilitado"})


@router.post("/{scenario_id}/restore", response_model=ResponseEnvelope[Scenario])
async def restore_scenario(
    scenario_id: int,
    session: AsyncSession = Depends(get_session),
    _: UserBase = Depends(require_roles("Administrador", "Representante de comisión")),
) -> ResponseEnvelope[Scenario]:
    scenario = await scenario_controller.restore_scenario(session, scenario_id)
    return ResponseEnvelope(data=scenario)


@router.delete("/{scenario_id}/force", response_model=ResponseEnvelope[dict])
async def delete_scenario_permanently(
    scenario_id: int,
    session: AsyncSession = Depends(get_session),
    _: UserBase = Depends(require_roles("Administrador", "Representante de comisión")),
) -> ResponseEnvelope[dict]:
    await scenario_controller.delete_scenario_permanently(session, scenario_id)
    return ResponseEnvelope(data={"message": "Escenario eliminado permanentemente"})
