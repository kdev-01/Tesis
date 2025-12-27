from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.configuration import AppSetting


async def get_app_settings(session: AsyncSession) -> AppSetting | None:
    result = await session.execute(select(AppSetting).limit(1))
    return result.scalar_one_or_none()


async def upsert_app_settings(
    session: AsyncSession,
    *,
    branding_name: str,
    support_email: str,
    maintenance_mode: bool,
) -> AppSetting:
    current = await get_app_settings(session)
    if current:
        current.branding_name = branding_name
        current.support_email = support_email
        current.maintenance_mode = maintenance_mode
        await session.flush()
        return current

    new_settings = AppSetting(
        branding_name=branding_name,
        support_email=support_email,
        maintenance_mode=maintenance_mode,
    )
    session.add(new_settings)
    await session.flush()
    return new_settings
