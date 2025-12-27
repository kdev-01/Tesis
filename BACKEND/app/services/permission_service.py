from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ApplicationError
from app.repositories import permission_repository, role_repository


class PermissionService:
    async def get_role_permissions(self, session: AsyncSession, role_id: int) -> list[str]:
        role = await role_repository.get_role_by_id(session, role_id)
        if not role:
            raise ApplicationError("Rol no encontrado", status_code=404)
        if role.nombre.strip().lower() != "representante de comisión":
            raise ApplicationError(
                "Solo se pueden gestionar permisos del rol Representante de comisión",
                status_code=400,
            )
        permissions = await permission_repository.list_permissions(session, role_id)
        return [perm.permiso for perm in permissions]

    async def update_role_permissions(self, session: AsyncSession, role_id: int, permissions: list[str]) -> list[str]:
        role = await role_repository.get_role_by_id(session, role_id)
        if not role:
            raise ApplicationError("Rol no encontrado", status_code=404)
        if role.nombre.strip().lower() != "representante de comisión":
            raise ApplicationError(
                "Solo se pueden gestionar permisos del rol Representante de comisión",
                status_code=400,
            )
        normalized = sorted({perm.strip() for perm in permissions if perm.strip()})
        await permission_repository.replace_permissions(session, role_id, normalized)
        await session.commit()
        return normalized


permission_service = PermissionService()
