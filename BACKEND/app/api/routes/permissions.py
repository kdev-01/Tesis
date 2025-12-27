from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_roles
from app.core.database import get_session
from app.schemas.common import ResponseEnvelope
from app.schemas.permission import PermissionsUpdate
from app.schemas.user import UserBase
from app.services.permission_service import permission_service

router = APIRouter(prefix="/permissions", tags=["permissions"])


@router.get("/roles/{role_id}", response_model=ResponseEnvelope[list[str]])
async def get_role_permissions(
    role_id: int,
    session: AsyncSession = Depends(get_session),
    _: UserBase = Depends(require_roles("Administrador")),
) -> ResponseEnvelope[list[str]]:
    permissions = await permission_service.get_role_permissions(session, role_id)
    return ResponseEnvelope(data=permissions)


@router.put("/roles/{role_id}", response_model=ResponseEnvelope[list[str]])
async def update_role_permissions(
    role_id: int,
    payload: PermissionsUpdate,
    session: AsyncSession = Depends(get_session),
    _: UserBase = Depends(require_roles("Administrador")),
) -> ResponseEnvelope[list[str]]:
    permissions = await permission_service.update_role_permissions(session, role_id, payload.permisos)
    return ResponseEnvelope(data=permissions)
