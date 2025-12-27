from __future__ import annotations

from datetime import datetime, timezone
from typing import Iterable, List

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import RolSistema


async def list_roles(session: AsyncSession) -> List[RolSistema]:
    result = await session.execute(select(RolSistema).order_by(RolSistema.nombre.asc()))
    return result.scalars().all()


async def get_role_by_id(session: AsyncSession, role_id: int) -> RolSistema | None:
    return await session.get(RolSistema, role_id)


async def get_roles_by_ids(session: AsyncSession, role_ids: Iterable[int]) -> List[RolSistema]:
    if not role_ids:
        return []
    result = await session.execute(
        select(RolSistema).where(RolSistema.id.in_(list(role_ids))).order_by(RolSistema.nombre.asc())
    )
    return result.scalars().all()


async def get_role_by_name(session: AsyncSession, name: str) -> RolSistema | None:
    result = await session.execute(
        select(RolSistema).where(func.lower(RolSistema.nombre) == func.lower(name)).limit(1)
    )
    return result.scalar_one_or_none()


async def create_role(
    session: AsyncSession,
    *,
    nombre: str,
    descripcion: str | None,
) -> RolSistema:
    role = RolSistema(
        nombre=nombre,
        descripcion=descripcion,
    )
    session.add(role)
    await session.flush()
    return role


async def update_role(
    session: AsyncSession,
    role: RolSistema,
    *,
    nombre: str | None = None,
    descripcion: str | None = None,
) -> RolSistema:
    updated = False
    if nombre is not None:
        role.nombre = nombre
        updated = True
    if descripcion is not None:
        role.descripcion = descripcion
        updated = True
    if updated:
        role.actualizado_en = datetime.now(timezone.utc)
    await session.flush()
    return role


async def delete_role(session: AsyncSession, role: RolSistema) -> None:
    role.usuarios.clear()
    await session.flush()
    await session.delete(role)
