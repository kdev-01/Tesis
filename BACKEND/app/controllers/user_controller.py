from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.services import data_service
from app.schemas.user import UserBase, UserCreate, UserProfileUpdate, UserUpdate


async def list_users(
    session: AsyncSession,
    *,
    page: int,
    page_size: int,
    search: str | None = None,
    include_deleted: bool = True,
    roles: list[str] | None = None,
    institucion_id: int | None = None,
    unassigned_only: bool = False,
):
    return await data_service.list_users(
        session,
        page=page,
        page_size=page_size,
        search=search,
        include_deleted=include_deleted,
        roles=roles,
        institucion_id=institucion_id,
        unassigned_only=unassigned_only,
    )


async def create_user(
    session: AsyncSession, payload: UserCreate, *, actor: UserBase | None = None
):
    return await data_service.create_user(session, payload, actor=actor)


async def update_user(
    session: AsyncSession,
    user_id: int,
    payload: UserUpdate,
    *,
    actor: UserBase | None = None,
):
    return await data_service.update_user(session, user_id, payload, actor=actor)


async def delete_user(
    session: AsyncSession, user_id: int, *, actor: UserBase | None = None
) -> None:
    await data_service.delete_user(session, user_id, actor=actor)


async def restore_user(
    session: AsyncSession, user_id: int, *, actor: UserBase | None = None
):
    return await data_service.restore_user(session, user_id, actor=actor)


async def delete_user_permanently(
    session: AsyncSession, user_id: int, *, actor: UserBase | None = None
) -> None:
    await data_service.delete_user_permanently(session, user_id, actor=actor)


async def update_profile(session: AsyncSession, user_id: int, payload: UserProfileUpdate):
    return await data_service.update_profile(session, user_id, payload)


async def send_account_recovery(session: AsyncSession, user_id: int) -> None:
    await data_service.send_account_recovery(session, user_id)
