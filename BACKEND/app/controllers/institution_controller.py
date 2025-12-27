from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.services import data_service
from app.schemas.institution import (
    InstitutionCreate,
    InstitutionDisaffiliation,
    InstitutionReaffiliation,
    InstitutionSanction,
    InstitutionSanctionLift,
    InstitutionUpdate,
)
from app.schemas.user import UserBase


async def list_institutions(
    session: AsyncSession,
    *,
    page: int,
    page_size: int,
    search: str | None = None,
    include_deleted: bool = False,
    actor: UserBase | None = None,
):
    return await data_service.list_institutions(
        session,
        page=page,
        page_size=page_size,
        search=search,
        include_deleted=include_deleted,
        actor=actor,
    )


async def create_institution(
    session: AsyncSession, payload: InstitutionCreate, *, actor: UserBase | None = None
):
    return await data_service.create_institution(session, payload, actor=actor)


async def update_institution(
    session: AsyncSession,
    institution_id: int,
    payload: InstitutionUpdate,
    *,
    actor: UserBase | None = None,
):
    return await data_service.update_institution(
        session, institution_id, payload, actor=actor
    )


async def get_institution(
    session: AsyncSession, institution_id: int, *, actor: UserBase | None = None
):
    return await data_service.get_institution(
        session, institution_id, actor=actor
    )


async def delete_institution(
    session: AsyncSession, institution_id: int, *, actor: UserBase | None = None
) -> None:
    await data_service.delete_institution(session, institution_id, actor=actor)


async def restore_institution(
    session: AsyncSession, institution_id: int, *, actor: UserBase | None = None
):
    return await data_service.restore_institution(session, institution_id, actor=actor)


async def delete_institution_permanently(
    session: AsyncSession, institution_id: int, *, actor: UserBase | None = None
) -> None:
    await data_service.delete_institution_permanently(session, institution_id, actor=actor)


async def disaffiliate_institution(
    session: AsyncSession, institution_id: int, payload: InstitutionDisaffiliation
):
    return await data_service.disaffiliate_institution(session, institution_id, payload)


async def reaffiliate_institution(
    session: AsyncSession, institution_id: int, payload: InstitutionReaffiliation | None = None
):
    return await data_service.reaffiliate_institution(session, institution_id, payload)


async def apply_sanction(
    session: AsyncSession, institution_id: int, payload: InstitutionSanction
):
    return await data_service.apply_institution_sanction(session, institution_id, payload)


async def lift_sanction(
    session: AsyncSession, institution_id: int, payload: InstitutionSanctionLift | None = None
):
    return await data_service.lift_institution_sanction(session, institution_id, payload)


async def list_selectable_institutions(session: AsyncSession):
    return await data_service.list_selectable_institutions(session)
