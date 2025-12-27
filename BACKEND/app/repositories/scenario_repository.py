from __future__ import annotations

from datetime import datetime, timezone
from datetime import datetime, timezone
from typing import List, Tuple

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.scenario import EscenarioDeportivo


async def get_scenario_by_id(session: AsyncSession, scenario_id: int) -> EscenarioDeportivo | None:
    return await session.get(EscenarioDeportivo, scenario_id)


async def get_scenario_by_name(
    session: AsyncSession,
    name: str,
    *,
    include_inactive: bool = True,
) -> EscenarioDeportivo | None:
    query = select(EscenarioDeportivo).where(
        func.lower(EscenarioDeportivo.nombre) == func.lower(name)
    )
    if not include_inactive:
        query = query.where(EscenarioDeportivo.activo.is_(True))
    result = await session.execute(query)
    return result.scalar_one_or_none()


async def list_scenarios(
    session: AsyncSession,
    *,
    page: int,
    page_size: int,
    search: str | None = None,
    include_inactive: bool = False,
) -> Tuple[List[EscenarioDeportivo], int]:
    query = select(EscenarioDeportivo)
    if search:
        like_term = f"%{search.lower()}%"
        query = query.where(
            func.lower(EscenarioDeportivo.nombre).like(like_term)
            | func.lower(EscenarioDeportivo.ciudad).like(like_term)
        )
    if not include_inactive:
        query = query.where(EscenarioDeportivo.activo.is_(True))

    total_result = await session.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar_one()

    result = await session.execute(
        query.order_by(EscenarioDeportivo.creado_en.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return result.scalars().all(), total


async def create_scenario(
    session: AsyncSession,
    *,
    nombre: str,
    direccion: str | None,
    ciudad: str | None,
    capacidad: int | None,
    foto_url: str | None,
) -> EscenarioDeportivo:
    now = datetime.now(timezone.utc)
    scenario = EscenarioDeportivo(
        nombre=nombre,
        direccion=direccion,
        ciudad=ciudad,
        capacidad=capacidad,
        foto_url=foto_url,
        activo=True,
        creado_en=now,
        actualizado_en=now,
    )
    session.add(scenario)
    await session.flush()
    return scenario


async def update_scenario(
    session: AsyncSession,
    scenario: EscenarioDeportivo,
    *,
    nombre: str | None = None,
    direccion: str | None = None,
    ciudad: str | None = None,
    capacidad: int | None = None,
    foto_url: str | None = None,
    activo: bool | None = None,
) -> EscenarioDeportivo:
    if nombre is not None:
        scenario.nombre = nombre
    if direccion is not None:
        scenario.direccion = direccion
    if ciudad is not None:
        scenario.ciudad = ciudad
    if capacidad is not None:
        scenario.capacidad = capacidad
    if foto_url is not None:
        scenario.foto_url = foto_url
    if activo is not None:
        scenario.activo = activo
    scenario.actualizado_en = datetime.now(timezone.utc)
    await session.flush()
    return scenario


async def logical_delete_scenario(session: AsyncSession, scenario: EscenarioDeportivo) -> EscenarioDeportivo:
    scenario.activo = False
    scenario.actualizado_en = datetime.now(timezone.utc)
    await session.flush()
    return scenario


async def restore_scenario(session: AsyncSession, scenario: EscenarioDeportivo) -> EscenarioDeportivo:
    scenario.activo = True
    scenario.actualizado_en = datetime.now(timezone.utc)
    await session.flush()
    return scenario


async def delete_scenario(session: AsyncSession, scenario: EscenarioDeportivo) -> None:
    await session.delete(scenario)
