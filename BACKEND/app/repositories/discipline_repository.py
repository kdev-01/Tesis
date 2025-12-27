from __future__ import annotations

from typing import Iterable, Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Disciplina


async def list_disciplines(
    session: AsyncSession, *, include_inactive: bool = False
) -> Sequence[Disciplina]:
    query = select(Disciplina)
    if not include_inactive:
        query = query.where(Disciplina.activo.is_(True))
    query = query.order_by(Disciplina.nombre.asc())
    result = await session.execute(query)
    return result.scalars().all()


async def get_disciplines_by_ids(
    session: AsyncSession, ids: Iterable[int], *, include_inactive: bool = False
) -> Sequence[Disciplina]:
    seen: set[int] = set()
    ordered_ids: list[int] = []
    for value in ids:
        if value is None:
            continue
        identifier = int(value)
        if identifier in seen:
            continue
        seen.add(identifier)
        ordered_ids.append(identifier)

    if not ordered_ids:
        return []
    query = select(Disciplina).where(Disciplina.id.in_(ordered_ids))
    if not include_inactive:
        query = query.where(Disciplina.activo.is_(True))
    result = await session.execute(query)
    disciplines = result.scalars().all()
    discipline_map = {disciplina.id: disciplina for disciplina in disciplines}
    # Preserve the requested order
    return [discipline_map[identifier] for identifier in ordered_ids if identifier in discipline_map]
