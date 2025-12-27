from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.role import RoleCreate, RoleUpdate
from app.services import data_service


async def list_roles(session: AsyncSession):
    return await data_service.list_roles(session)


async def create_role(session: AsyncSession, payload: RoleCreate):
    return await data_service.create_role(session, payload)


async def update_role(session: AsyncSession, role_id: int, payload: RoleUpdate):
    return await data_service.update_role(session, role_id, payload)


async def delete_role(session: AsyncSession, role_id: int) -> None:
    await data_service.delete_role(session, role_id)
