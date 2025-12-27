from __future__ import annotations

from datetime import datetime, timezone
from typing import Iterable, List, Mapping, Sequence, Tuple

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.event import (
    CategoriaDeportiva,
    Evento,
    EventoEscenario,
    EventoInscripcion,
    EventoInscripcionEstudiante,
    EventoInstitucion,
)


async def list_events(
    session: AsyncSession,
    *,
    page: int,
    page_size: int,
    search: str | None = None,
    deporte_id: int | None = None,
) -> Tuple[List[Evento], int]:
    base_query = (
        select(Evento)
        .options(
            selectinload(Evento.deporte),
            selectinload(Evento.instituciones_invitadas).selectinload(
                EventoInstitucion.institucion
            ),
            selectinload(Evento.categorias),
            selectinload(Evento.escenarios).selectinload(EventoEscenario.escenario),
            selectinload(Evento.configuracion),
        )
        .where(Evento.eliminado.is_(False))
    )
    if deporte_id is not None:
        base_query = base_query.where(Evento.deporte_id == int(deporte_id))
    if search:
        like_term = f'%{search}%'
        base_query = base_query.where(Evento.titulo.ilike(like_term))

    total_result = await session.execute(
        select(func.count()).select_from(base_query.subquery())
    )
    total = total_result.scalar_one()

    query = (
        base_query.order_by(Evento.fecha_inscripcion_inicio.desc().nullslast())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await session.execute(query)
    events = result.scalars().all()
    return events, total


async def get_event_by_id(
    session: AsyncSession, event_id: int, *, include_institutions: bool = True
) -> Evento | None:
    select_options = [
        selectinload(Evento.deporte),
        selectinload(Evento.categorias),
        selectinload(Evento.escenarios).selectinload(EventoEscenario.escenario),
        selectinload(Evento.configuracion),
    ]
    if include_institutions:
        select_options.insert(
            1,
            selectinload(Evento.instituciones_invitadas).selectinload(
                EventoInstitucion.institucion
            ),
        )

    result = await session.execute(
        select(Evento)
        .options(*select_options)
        .where(Evento.id == event_id)
    )
    return result.scalars().first()


async def create_event(
    session: AsyncSession,
    *,
    administrador_id: int,
    titulo: str,
    descripcion: str | None,
    estado: str,
    sexo_evento: str,
    deporte_id: int,
    fecha_inscripcion_inicio,
    fecha_inscripcion_fin,
    fecha_auditoria_inicio,
    fecha_auditoria_fin,
    periodo_academico: str,
    fecha_campeonato_inicio,
    fecha_campeonato_fin,
    documento_planeacion: str | None,
    imagen_portada: str | None,
    categorias: Iterable[CategoriaDeportiva] = (),
    escenarios: Sequence[Mapping[str, int | str | None]] = (),
) -> Evento:
    now = datetime.now(timezone.utc)

    event = Evento(
        administrador_id=administrador_id,
        titulo=titulo,
        descripcion=descripcion,
        estado=estado,
        sexo_evento=sexo_evento,
        deporte_id=deporte_id,
        fecha_auditoria_inicio=fecha_auditoria_inicio,
        fecha_auditoria_fin=fecha_auditoria_fin,
        fecha_campeonato_inicio=fecha_campeonato_inicio,
        fecha_campeonato_fin=fecha_campeonato_fin,
        fecha_inscripcion_inicio=fecha_inscripcion_inicio,
        fecha_inscripcion_fin=fecha_inscripcion_fin,
        periodo_academico=periodo_academico,
        documento_planeacion=documento_planeacion,
        imagen_portada=imagen_portada,
        creado_en=now,
        actualizado_en=now,
    )

    # 👇 Asignar relaciones ANTES del flush, cuando todavía no hay nada en BD
    if categorias:
        event.categorias = list(categorias)

    if escenarios:
        event.escenarios = [
            EventoEscenario(
                escenario_id=item.get("escenario_id"),
                nombre_escenario=str(item.get("nombre_escenario") or "").strip(),
            )
            for item in escenarios
            if str(item.get("nombre_escenario") or "").strip()
        ]

    session.add(event)
    await session.flush()  # 👈 ÚNICO flush, al final

    return event



async def update_event(
    session: AsyncSession,
    event: Evento,
    *,
    titulo: str | None = None,
    descripcion: str | None = None,
    sexo_evento: str | None = None,
    deporte_id: int | None = None,
    fecha_auditoria_inicio,
    fecha_auditoria_fin,
    fecha_campeonato_inicio,
    fecha_campeonato_fin,
    fecha_inscripcion_inicio,
    fecha_inscripcion_fin,
    estado: str | None,
    documento_planeacion: str | None = None,
    imagen_portada: str | None = None,
    clear_cover_image: bool = False,
    categorias: Iterable[CategoriaDeportiva] | None = None,
    escenarios: Sequence[Mapping[str, int | str | None]] | None = None,
) -> Evento:
    if titulo is not None:
        event.titulo = titulo
    if descripcion is not None:
        event.descripcion = descripcion
    if estado is not None:
        event.estado = estado
    if sexo_evento is not None:
        event.sexo_evento = sexo_evento
    if deporte_id is not None:
        event.deporte_id = deporte_id
    event.fecha_auditoria_inicio = fecha_auditoria_inicio
    event.fecha_auditoria_fin = fecha_auditoria_fin
    event.fecha_campeonato_inicio = fecha_campeonato_inicio
    event.fecha_campeonato_fin = fecha_campeonato_fin
    event.fecha_inscripcion_inicio = fecha_inscripcion_inicio
    event.fecha_inscripcion_fin = fecha_inscripcion_fin
    if documento_planeacion is not None:
        event.documento_planeacion = documento_planeacion
    if imagen_portada is not None:
        event.imagen_portada = imagen_portada
    elif clear_cover_image:
        event.imagen_portada = None
    if categorias is not None:
        event.categorias = list(categorias)
    if escenarios is not None:
        event.escenarios = [
            EventoEscenario(
                escenario_id=item.get("escenario_id"),
                nombre_escenario=str(item.get("nombre_escenario") or "").strip(),
            )
            for item in escenarios
            if str(item.get("nombre_escenario") or "").strip()
        ]
    event.actualizado_en = datetime.now(timezone.utc)
    await session.flush()
    return event


async def replace_invited_institutions(
    session: AsyncSession, event: Evento, institution_ids: Iterable[int]
) -> None:
    desired = {int(inst_id) for inst_id in institution_ids if inst_id is not None}

    # 🔐 Cargar invitaciones actuales desde la BD (sin usar lazy loading)
    result = await session.execute(
        select(EventoInstitucion).where(EventoInstitucion.evento_id == event.id)
    )
    current_items = result.scalars().all()
    current = {item.institucion_id for item in current_items}

    # Eliminar las que ya no deben estar
    for item in current_items:
        if item.institucion_id not in desired:
            await session.delete(item)
        else:
            if not item.estado_invitacion:
                item.estado_invitacion = "pendiente"

    # Crear las nuevas
    for inst_id in desired - current:
        session.add(
            EventoInstitucion(
                evento_id=event.id,
                institucion_id=inst_id,
                estado_invitacion="pendiente",
            )
        )

    await session.flush()

async def logical_delete_event(session: AsyncSession, event: Evento) -> Evento:
    event.eliminado = True
    if event.estado not in {"archivado", "finalizado"}:
        event.estado = "archivado"
    event.actualizado_en = datetime.now(timezone.utc)
    await session.flush()
    return event


async def delete_event(session: AsyncSession, event: Evento) -> None:
    await session.delete(event)
