from __future__ import annotations

from typing import Iterable, Sequence

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import CategoriaDeportiva


async def list_categories(
    session: AsyncSession,
    *,
    deporte_id: int | None = None,
    include_inactive: bool = False,
) -> Sequence[CategoriaDeportiva]:
    query = select(CategoriaDeportiva)
    if deporte_id is not None:
        query = query.where(CategoriaDeportiva.deporte_id == int(deporte_id))
    if not include_inactive:
        query = query.where(CategoriaDeportiva.activo.is_(True))
    query = query.order_by(CategoriaDeportiva.nombre.asc())
    result = await session.execute(query)
    return result.scalars().all()


async def get_categories_by_ids(
    session: AsyncSession,
    identifiers: Iterable[int],
    *,
    include_inactive: bool = False,
) -> Sequence[CategoriaDeportiva]:
    ids = []
    seen: set[int] = set()
    for identifier in identifiers:
        if identifier is None:
            continue
        value = int(identifier)
        if value in seen:
            continue
        seen.add(value)
        ids.append(value)
    if not ids:
        return []
    query = select(CategoriaDeportiva).where(CategoriaDeportiva.id.in_(ids))
    if not include_inactive:
        query = query.where(CategoriaDeportiva.activo.is_(True))
    result = await session.execute(query)
    categories = result.scalars().all()
    category_map = {category.id: category for category in categories}
    return [category_map[value] for value in ids if value in category_map]


async def get_category_by_id(
    session: AsyncSession, category_id: int, *, include_inactive: bool = False
) -> CategoriaDeportiva | None:
    query = select(CategoriaDeportiva).where(
        CategoriaDeportiva.id == int(category_id)
    )
    if not include_inactive:
        query = query.where(CategoriaDeportiva.activo.is_(True))
    result = await session.execute(query)
    return result.scalars().first()


async def get_category_by_name(
    session: AsyncSession,
    *,
    deporte_id: int,
    nombre: str,
    include_inactive: bool = True,
) -> CategoriaDeportiva | None:
    normalized = (nombre or "").strip().lower()
    if not normalized:
        return None
    query = select(CategoriaDeportiva).where(
        CategoriaDeportiva.deporte_id == int(deporte_id),
        func.lower(CategoriaDeportiva.nombre) == normalized,
    )
    if not include_inactive:
        query = query.where(CategoriaDeportiva.activo.is_(True))
    result = await session.execute(query)
    return result.scalars().first()


async def create_category(
    session: AsyncSession,
    *,
    deporte_id: int,
    nombre: str,
    edad_minima: int | None = None,
    edad_maxima: int | None = None,
    activo: bool = True,
) -> CategoriaDeportiva:
    category = CategoriaDeportiva(
        deporte_id=deporte_id,
        nombre=nombre,
        edad_minima=edad_minima,
        edad_maxima=edad_maxima,
        activo=activo,
    )
    session.add(category)
    await session.flush()
    return category


async def update_category(
    session: AsyncSession,
    category: CategoriaDeportiva,
    *,
    nombre: str | None = None,
    edad_minima: int | None = None,
    edad_minima_set: bool = False,
    edad_maxima: int | None = None,
    edad_maxima_set: bool = False,
    activo: bool | None = None,
) -> CategoriaDeportiva:
    if nombre is not None:
        category.nombre = nombre
    if edad_minima_set:
        category.edad_minima = edad_minima
    if edad_maxima_set:
        category.edad_maxima = edad_maxima
    if activo is not None:
        category.activo = bool(activo)
    await session.flush()
    return category
