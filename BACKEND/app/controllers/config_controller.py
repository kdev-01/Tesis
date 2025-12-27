from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.services import data_service


async def get_settings(session: AsyncSession):
    return await data_service.get_settings(session)


async def update_settings(
    session: AsyncSession,
    *,
    branding_name: str,
    support_email: str,
    maintenance_mode: bool,
):
    return await data_service.update_settings(
        session,
        branding_name=branding_name,
        support_email=support_email,
        maintenance_mode=maintenance_mode,
    )


async def list_sports(session: AsyncSession):
    return await data_service.list_sports_for_management(session)


async def create_sport(session: AsyncSession, payload):
    return await data_service.create_sport(session, payload)


async def update_sport(session: AsyncSession, sport_id: int, payload):
    return await data_service.update_sport(session, sport_id, payload)


async def list_categories(session: AsyncSession, *, deporte_id: int | None = None):
    return await data_service.list_categories_for_management(
        session, deporte_id=deporte_id
    )


async def create_category(session: AsyncSession, payload):
    return await data_service.create_category(session, payload)


async def update_category(
    session: AsyncSession, category_id: int, payload
):
    return await data_service.update_category(session, category_id, payload)
