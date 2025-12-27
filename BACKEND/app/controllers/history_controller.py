from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.history import HistoryFilters
from app.services import data_service


async def get_history(
    session: AsyncSession,
    *,
    filters: HistoryFilters | None,
    page: int,
    page_size: int,
):
    return await data_service.get_consolidated_history(
        session,
        filters=filters,
        page=page,
        page_size=page_size,
    )
