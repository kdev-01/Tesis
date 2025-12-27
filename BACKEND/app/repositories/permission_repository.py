from __future__ import annotations

from typing import Iterable

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.security import RolePermission


async def list_permissions(session: AsyncSession, role_id: int) -> list[RolePermission]:
    result = await session.execute(select(RolePermission).where(RolePermission.rol_id == role_id))
    return result.scalars().all()


async def replace_permissions(session: AsyncSession, role_id: int, permissions: Iterable[str]) -> list[RolePermission]:
    await session.execute(delete(RolePermission).where(RolePermission.rol_id == role_id))
    entities: list[RolePermission] = []
    for perm in permissions:
        entity = RolePermission(rol_id=role_id, permiso=perm)
        session.add(entity)
        entities.append(entity)
    await session.flush()
    return entities
