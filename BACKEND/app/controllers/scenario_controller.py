from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.scenario import ScenarioCreate, ScenarioUpdate
from app.services import data_service


async def list_scenarios(
    session: AsyncSession,
    *,
    page: int,
    page_size: int,
    search: str | None = None,
    include_inactive: bool = False,
):
    return await data_service.list_scenarios(
        session,
        page=page,
        page_size=page_size,
        search=search,
        include_inactive=include_inactive,
    )


async def create_scenario(session: AsyncSession, payload: ScenarioCreate):
    return await data_service.create_scenario(session, payload)


async def update_scenario(session: AsyncSession, scenario_id: int, payload: ScenarioUpdate):
    return await data_service.update_scenario(session, scenario_id, payload)


async def delete_scenario(session: AsyncSession, scenario_id: int) -> None:
    await data_service.delete_scenario(session, scenario_id)


async def restore_scenario(session: AsyncSession, scenario_id: int):
    return await data_service.restore_scenario(session, scenario_id)


async def delete_scenario_permanently(session: AsyncSession, scenario_id: int) -> None:
    await data_service.delete_scenario_permanently(session, scenario_id)
