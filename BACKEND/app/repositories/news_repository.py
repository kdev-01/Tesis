from __future__ import annotations

from datetime import datetime
from typing import Iterable, Sequence

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.news import Noticia


def _build_visibility_clause():
    return and_(
        Noticia.estado == "publicado",
        Noticia.fecha_publicacion.is_not(None),
        Noticia.fecha_publicacion <= func.now(),
    )


async def list_news(
    session: AsyncSession,
    *,
    page: int,
    page_size: int,
    search: str | None = None,
    estados: Sequence[str] | None = None,
    categoria: str | None = None,
    destacado: bool | None = None,
    tags: Sequence[str] | None = None,
    autor_ids: Sequence[int] | None = None,
    fecha_desde: datetime | None = None,
    fecha_hasta: datetime | None = None,
    only_visible: bool = False,
    order_by: str = "fecha_publicacion",
    order_desc: bool = True,
) -> tuple[list[Noticia], int]:
    base_query = (
        select(Noticia)
        .options(selectinload(Noticia.autor))
        .where(Noticia.eliminado.is_(False))
    )

    if only_visible:
        base_query = base_query.where(_build_visibility_clause())

    if estados:
        base_query = base_query.where(Noticia.estado.in_(estados))

    if categoria:
        base_query = base_query.where(func.lower(Noticia.categoria) == categoria.lower())

    if destacado is not None:
        base_query = base_query.where(Noticia.destacado.is_(destacado))

    if tags:
        normalized_tags = [tag.strip() for tag in tags if tag and tag.strip()]
        if normalized_tags:
            base_query = base_query.where(Noticia.etiquetas.contains(normalized_tags))

    if autor_ids:
        base_query = base_query.where(Noticia.autor_id.in_(autor_ids))

    if fecha_desde:
        base_query = base_query.where(Noticia.fecha_publicacion >= fecha_desde)
    if fecha_hasta:
        base_query = base_query.where(Noticia.fecha_publicacion <= fecha_hasta)

    if search:
        like_term = f"%{search}%"
        base_query = base_query.where(
            or_(
                Noticia.titulo.ilike(like_term),
                Noticia.resumen.ilike(like_term),
                Noticia.contenido.ilike(like_term),
            )
        )

    total_result = await session.execute(select(func.count()).select_from(base_query.subquery()))
    total = total_result.scalar_one()

    order_clauses = []
    order_key = order_by.lower() if order_by else "fecha_publicacion"
    if order_key == "orden":
        order_clauses.append(Noticia.destacado.desc())
        order_clauses.append(Noticia.orden.asc())
        order_clauses.append(Noticia.fecha_publicacion.desc().nullslast())
        order_clauses.append(Noticia.creado_en.desc())
    else:
        column = Noticia.fecha_publicacion if order_key == "fecha_publicacion" else Noticia.creado_en
        if order_desc:
            order_clauses.append(column.desc().nullslast())
        else:
            order_clauses.append(column.asc().nullslast())
        order_clauses.append(Noticia.destacado.desc())
        order_clauses.append(Noticia.orden.asc())

    query = base_query.order_by(*order_clauses).offset((page - 1) * page_size).limit(page_size)
    result = await session.execute(query)
    return result.scalars().all(), total


async def get_news_by_id(session: AsyncSession, news_id: int) -> Noticia | None:
    result = await session.execute(
        select(Noticia)
        .options(selectinload(Noticia.autor))
        .where(Noticia.id == news_id, Noticia.eliminado.is_(False))
    )
    return result.scalars().first()


async def get_news_by_slug(session: AsyncSession, slug: str, *, only_visible: bool = False) -> Noticia | None:
    conditions = [Noticia.slug == slug, Noticia.eliminado.is_(False)]
    if only_visible:
        conditions.append(_build_visibility_clause())
    result = await session.execute(
        select(Noticia)
        .options(selectinload(Noticia.autor))
        .where(and_(*conditions))
    )
    return result.scalars().first()


async def create_news(
    session: AsyncSession,
    *,
    titulo: str,
    slug: str,
    resumen: str | None,
    contenido: str,
    categoria: str | None,
    etiquetas: list[str],
    estado: str,
    destacado: bool,
    orden: int,
    fecha_publicacion: datetime | None,
    autor_id: int | None,
) -> Noticia:
    noticia = Noticia(
        titulo=titulo,
        slug=slug,
        resumen=resumen,
        contenido=contenido,
        categoria=categoria,
        etiquetas=etiquetas,
        estado=estado,
        destacado=destacado,
        orden=orden,
        fecha_publicacion=fecha_publicacion,
        autor_id=autor_id,
    )
    session.add(noticia)
    await session.flush()
    await session.refresh(noticia)
    return noticia


async def update_news(
    session: AsyncSession,
    noticia: Noticia,
    *,
    titulo: str | None = None,
    slug: str | None = None,
    resumen: str | None = None,
    contenido: str | None = None,
    categoria: str | None = None,
    etiquetas: Iterable[str] | None = None,
    estado: str | None = None,
    destacado: bool | None = None,
    orden: int | None = None,
    fecha_publicacion: datetime | None = None,
    autor_id: int | None = None,
) -> Noticia:
    if titulo is not None:
        noticia.titulo = titulo
    if slug is not None:
        noticia.slug = slug
    if resumen is not None:
        noticia.resumen = resumen
    if contenido is not None:
        noticia.contenido = contenido
    if categoria is not None:
        noticia.categoria = categoria
    if etiquetas is not None:
        noticia.etiquetas = list(etiquetas)
    if estado is not None:
        noticia.estado = estado
    if destacado is not None:
        noticia.destacado = destacado
    if orden is not None:
        noticia.orden = orden
    if fecha_publicacion is not None or estado in {"borrador", "archivado"}:
        noticia.fecha_publicacion = fecha_publicacion
    if autor_id is not None:
        noticia.autor_id = autor_id

    await session.flush()
    await session.refresh(noticia)
    return noticia


async def delete_news(session: AsyncSession, noticia: Noticia) -> None:
    noticia.eliminado = True
    await session.flush()


async def list_distinct_categories(
    session: AsyncSession,
    *,
    only_visible: bool = False,
) -> list[str]:
    query = select(func.distinct(Noticia.categoria)).where(
        Noticia.categoria.is_not(None), Noticia.categoria != "", Noticia.eliminado.is_(False)
    )
    if only_visible:
        query = query.where(_build_visibility_clause())
    result = await session.execute(query)
    categories = [row[0] for row in result.fetchall() if row[0]]
    return sorted({cat.strip() for cat in categories if cat})


async def list_distinct_tags(
    session: AsyncSession,
    *,
    only_visible: bool = False,
) -> list[str]:
    query = select(Noticia.etiquetas).where(Noticia.eliminado.is_(False))
    if only_visible:
        query = query.where(_build_visibility_clause())
    result = await session.execute(query)
    tags: set[str] = set()
    for tag_list in result.scalars():
        if not isinstance(tag_list, list):
            continue
        for tag in tag_list:
            if isinstance(tag, str) and tag.strip():
                tags.add(tag.strip())
    return sorted(tags)
