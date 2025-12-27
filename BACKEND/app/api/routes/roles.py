from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_roles
from app.controllers import role_controller
from app.core.database import get_session
from app.schemas.common import ResponseEnvelope
from app.schemas.role import RoleBase, RoleCreate, RoleUpdate
from app.schemas.user import UserBase

admin_role_guard = require_roles("Administrador", "Representante de comisión")

router = APIRouter(prefix="/roles", tags=["roles"])


@router.get("/", response_model=ResponseEnvelope[list[RoleBase]])
async def list_roles(
    session: AsyncSession = Depends(get_session),
    _: UserBase = Depends(admin_role_guard),
) -> ResponseEnvelope[list[RoleBase]]:
    roles = await role_controller.list_roles(session)
    return ResponseEnvelope(data=roles)


@router.post("/", response_model=ResponseEnvelope[RoleBase], status_code=status.HTTP_201_CREATED)
async def create_role(
    payload: RoleCreate,
    session: AsyncSession = Depends(get_session),
    _: UserBase = Depends(admin_role_guard),
) -> ResponseEnvelope[RoleBase]:
    role = await role_controller.create_role(session, payload)
    return ResponseEnvelope(data=role)


@router.put("/{role_id}", response_model=ResponseEnvelope[RoleBase])
async def update_role(
    role_id: int,
    payload: RoleUpdate,
    session: AsyncSession = Depends(get_session),
    _: UserBase = Depends(admin_role_guard),
) -> ResponseEnvelope[RoleBase]:
    role = await role_controller.update_role(session, role_id, payload)
    return ResponseEnvelope(data=role)


@router.delete("/{role_id}", response_model=ResponseEnvelope[dict])
async def delete_role(
    role_id: int,
    session: AsyncSession = Depends(get_session),
    _: UserBase = Depends(admin_role_guard),
) -> ResponseEnvelope[dict]:
    await role_controller.delete_role(session, role_id)
    return ResponseEnvelope(data={"message": "Rol eliminado"})
