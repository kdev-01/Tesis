from __future__ import annotations

from __future__ import annotations

from datetime import datetime, timezone
from typing import Iterable, List, Tuple

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.institution import Institucion
from app.models.user import Usuario


async def get_institution_by_id(session: AsyncSession, institution_id: int) -> Institucion | None:
    return await session.get(Institucion, institution_id)


async def get_institution_by_name(
    session: AsyncSession,
    name: str,
    *,
    include_deleted: bool = False,
) -> Institucion | None:
    query = select(Institucion).where(func.lower(Institucion.nombre) == func.lower(name))
    if not include_deleted:
        query = query.where(Institucion.eliminado.is_(False))
    result = await session.execute(query)
    return result.scalar_one_or_none()


async def get_institution_by_email(
    session: AsyncSession,
    email: str,
    *,
    include_deleted: bool = False,
) -> Institucion | None:
    query = select(Institucion).where(func.lower(Institucion.email) == func.lower(email))
    if not include_deleted:
        query = query.where(Institucion.eliminado.is_(False))
    result = await session.execute(query)
    return result.scalar_one_or_none()


async def get_institutions_by_ids(
    session: AsyncSession, institution_ids: Iterable[int]
) -> List[Institucion]:
    ids = {int(value) for value in institution_ids if value is not None}
    if not ids:
        return []
    result = await session.execute(
        select(Institucion).where(Institucion.id.in_(ids), Institucion.eliminado.is_(False))
    )
    return list(result.scalars().all())


async def get_selectable_institutions_by_ids(
    session: AsyncSession, institution_ids: Iterable[int]
) -> List[Institucion]:
    ids = {int(value) for value in institution_ids if value is not None}
    if not ids:
        return []
    result = await session.execute(
        select(Institucion)
        .options(
            selectinload(Institucion.representantes).selectinload(Usuario.roles)
        )
        .where(
            Institucion.id.in_(ids),
            Institucion.estado == "activa",
            Institucion.sancion_activa.is_(False),
            Institucion.eliminado.is_(False),
        )
    )
    return list(result.scalars().all())


async def list_selectable_institutions(session: AsyncSession) -> List[Institucion]:
    result = await session.execute(
        select(Institucion)
        .where(
            Institucion.estado == "activa",
            Institucion.sancion_activa.is_(False),
            Institucion.eliminado.is_(False),
        )
        .order_by(Institucion.nombre.asc())
    )
    return list(result.scalars().all())


async def list_institutions(
    session: AsyncSession,
    *,
    page: int,
    page_size: int,
    search: str | None = None,
    include_deleted: bool = False,
) -> Tuple[List[Institucion], int]:
    base_query = select(Institucion)
    if not include_deleted:
        base_query = base_query.where(Institucion.eliminado.is_(False))
    if search:
        like_term = f"%{search.lower()}%"
        base_query = base_query.where(
            func.lower(Institucion.nombre).like(like_term)
            | func.lower(Institucion.ciudad).like(like_term)
        )

    total_result = await session.execute(select(func.count()).select_from(base_query.subquery()))
    total = total_result.scalar_one()

    query = base_query.order_by(Institucion.creado_en.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await session.execute(query)
    institutions = result.scalars().all()
    return institutions, total


async def create_institution(
    session: AsyncSession,
    *,
    nombre: str,
    descripcion: str | None,
    direccion: str | None,
    ciudad: str | None,
    email: str | None,
    telefono: str | None,
    portada_url: str | None,
    estado: str,
) -> Institucion:
    now = datetime.now(timezone.utc)
    institution = Institucion(
        nombre=nombre,
        descripcion=descripcion,
        direccion=direccion,
        ciudad=ciudad,
        email=email,
        telefono=telefono,
        portada_url=portada_url,
        estado=estado,
        motivo_desafiliacion=None,
        fecha_desafiliacion=None,
        fecha_reafiliacion=None,
        sancion_motivo=None,
        sancion_tipo=None,
        sancion_inicio=None,
        sancion_fin=None,
        sancion_activa=False,
        creado_en=now,
        actualizado_en=now,
    )
    session.add(institution)
    await session.flush()
    return institution


async def update_institution(
    session: AsyncSession,
    institution: Institucion,
    *,
    nombre: str | None = None,
    descripcion: str | None = None,
    direccion: str | None = None,
    ciudad: str | None = None,
    email: str | None = None,
    telefono: str | None = None,
    portada_url: str | None = None,
    estado: str | None = None,
    clear_portada: bool = False,
) -> Institucion:
    if nombre is not None:
        institution.nombre = nombre
    if descripcion is not None:
        institution.descripcion = descripcion
    if direccion is not None:
        institution.direccion = direccion
    if ciudad is not None:
        institution.ciudad = ciudad
    if email is not None:
        institution.email = email
    if telefono is not None:
        institution.telefono = telefono
    if clear_portada:
        institution.portada_url = None
    elif portada_url is not None:
        institution.portada_url = portada_url
    if estado is not None:
        institution.estado = estado
    institution.actualizado_en = datetime.now(timezone.utc)
    await session.flush()
    return institution


async def logical_delete_institution(
    session: AsyncSession, institution: Institucion, *, actor_id: int | None = None
) -> Institucion:
    now = datetime.now(timezone.utc)
    institution.eliminado = True
    institution.eliminado_en = now
    institution.eliminado_por = actor_id
    await session.flush()
    return institution


async def restore_institution(session: AsyncSession, institution: Institucion) -> Institucion:
    institution.eliminado = False
    institution.eliminado_en = None
    institution.eliminado_por = None
    await session.flush()
    return institution


async def hard_delete_institution(session: AsyncSession, institution: Institucion) -> None:
    await session.delete(institution)


async def disaffiliate_institution(
    session: AsyncSession,
    institution: Institucion,
    *,
    motivo: str,
) -> Institucion:
    now = datetime.now(timezone.utc)
    institution.estado = "desafiliada"
    institution.motivo_desafiliacion = motivo
    institution.fecha_desafiliacion = now
    institution.sancion_activa = False
    institution.actualizado_en = now
    await session.flush()
    return institution


async def reaffiliate_institution(session: AsyncSession, institution: Institucion) -> Institucion:
    now = datetime.now(timezone.utc)
    institution.estado = "activa"
    institution.fecha_reafiliacion = now
    institution.actualizado_en = now
    institution.sancion_activa = False
    await session.flush()
    return institution


async def apply_institution_sanction(
    session: AsyncSession,
    institution: Institucion,
    *,
    motivo: str,
    tipo: str,
    inicio: datetime,
    fin: datetime | None,
) -> Institucion:
    institution.estado = "sancionada"
    institution.sancion_activa = True
    institution.sancion_motivo = motivo
    institution.sancion_tipo = tipo
    institution.sancion_inicio = inicio
    institution.sancion_fin = fin
    institution.actualizado_en = datetime.now(timezone.utc)
    await session.flush()
    return institution


async def clear_institution_sanction(session: AsyncSession, institution: Institucion) -> Institucion:
    institution.sancion_activa = False
    if institution.estado == "sancionada":
        institution.estado = "activa"
    institution.sancion_fin = institution.sancion_fin or datetime.now(timezone.utc)
    institution.actualizado_en = datetime.now(timezone.utc)
    await session.flush()
    return institution
