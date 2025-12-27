from __future__ import annotations

from collections.abc import Iterable, Sequence
from datetime import datetime, timezone

from sqlalchemy import delete, select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.event import (
    Evento,
    EventoAuditoria,
    EventoInscripcion,
    EventoInscripcionEstudiante,
    EventoInscripcionEstudianteDocumento,
    EventoInscripcionDocumentoPendiente,
    EventoInstitucion,
    EventoInstitucionRegla,
    EventoPartido,
)
from app.models.institution import Institucion
from app.models.user import Usuario


async def list_invitations_by_institution(
    session: AsyncSession, *, institucion_id: int
) -> list[EventoInstitucion]:
    query = (
        select(EventoInstitucion)
        .options(
            # Evento y sus relaciones
            selectinload(EventoInstitucion.evento).options(
                selectinload(Evento.categorias),
                selectinload(Evento.deporte),
                selectinload(Evento.inscripciones).options(
                    selectinload(EventoInscripcion.estudiantes).options(
                        selectinload(EventoInscripcionEstudiante.estudiante),
                        # ⬇️ RELACIÓN documentos, no la clase
                        selectinload(EventoInscripcionEstudiante.documentos)
                        .selectinload(EventoInscripcionEstudianteDocumento.revisado_por),
                    )
                ),
            ),
            # Institución -> representantes -> roles
            selectinload(EventoInstitucion.institucion).options(
                selectinload(Institucion.representantes).options(
                    selectinload(Usuario.roles)
                )
            ),
            # Regla por institución
            selectinload(EventoInstitucion.reglas),
            # Inscripciones asociadas a la institución
            selectinload(EventoInstitucion.inscripciones).options(
                selectinload(EventoInscripcion.estudiantes).options(
                    selectinload(EventoInscripcionEstudiante.estudiante),
                    # ⬇️ Igual aquí
                    selectinload(EventoInscripcionEstudiante.documentos)
                    .selectinload(EventoInscripcionEstudianteDocumento.revisado_por),
                )
            ),
            selectinload(EventoInstitucion.documentos_pendientes),
        )
        .where(EventoInstitucion.institucion_id == institucion_id)
    )
    result = await session.execute(query)
    return list(result.scalars().all())


async def list_event_invitations(
    session: AsyncSession, *, event_id: int
) -> list[EventoInstitucion]:
    query = (
        select(EventoInstitucion)
        .options(
            selectinload(EventoInstitucion.evento).options(
                selectinload(Evento.categorias),
                selectinload(Evento.deporte),
                selectinload(Evento.inscripciones).options(
                    selectinload(EventoInscripcion.estudiantes).options(
                        selectinload(EventoInscripcionEstudiante.estudiante),
                        selectinload(EventoInscripcionEstudiante.documentos)
                        .selectinload(EventoInscripcionEstudianteDocumento.revisado_por),
                    )
                ),
            ),
            selectinload(EventoInstitucion.institucion).options(
                selectinload(Institucion.representantes).options(
                    selectinload(Usuario.roles)
                )
            ),
            selectinload(EventoInstitucion.reglas),
            selectinload(EventoInstitucion.inscripciones).options(
                selectinload(EventoInscripcion.estudiantes).options(
                    selectinload(EventoInscripcionEstudiante.estudiante),
                    selectinload(EventoInscripcionEstudiante.documentos)
                    .selectinload(EventoInscripcionEstudianteDocumento.revisado_por),
                )
            ),
            selectinload(EventoInstitucion.documentos_pendientes),
            selectinload(EventoInstitucion.auditorias),
        )
        .where(EventoInstitucion.evento_id == event_id)
        .order_by(EventoInstitucion.id)
    )
    result = await session.execute(query)
    return list(result.scalars().all())


async def get_event_institution(
    session: AsyncSession, *, event_id: int, institucion_id: int
) -> EventoInstitucion | None:
    query = (
        select(EventoInstitucion)
        .options(
            selectinload(EventoInstitucion.evento).options(
                selectinload(Evento.categorias),
                selectinload(Evento.deporte),
                selectinload(Evento.escenarios),
                selectinload(Evento.inscripciones).options(
                    selectinload(EventoInscripcion.estudiantes).options(
                        selectinload(EventoInscripcionEstudiante.estudiante),
                        selectinload(EventoInscripcionEstudiante.documentos)
                        .selectinload(EventoInscripcionEstudianteDocumento.revisado_por),
                    )
                ),
            ),
            selectinload(EventoInstitucion.institucion).options(
                selectinload(Institucion.representantes).options(
                    selectinload(Usuario.roles)
                )
            ),
            selectinload(EventoInstitucion.reglas),
            selectinload(EventoInstitucion.inscripciones).options(
                selectinload(EventoInscripcion.estudiantes).options(
                    selectinload(EventoInscripcionEstudiante.estudiante),
                    selectinload(EventoInscripcionEstudiante.documentos)
                    .selectinload(EventoInscripcionEstudianteDocumento.revisado_por),
                )
            ),
            selectinload(EventoInstitucion.documentos_pendientes),
            selectinload(EventoInstitucion.auditorias),
        )
        .where(
            EventoInstitucion.evento_id == event_id,
            EventoInstitucion.institucion_id == institucion_id,
        )
    )
    result = await session.execute(query)
    return result.scalars().first()


async def upsert_rule(
    session: AsyncSession,
    *,
    evento_institucion: EventoInstitucion,
    min_participantes: int,
    max_participantes: int,
    observaciones: str | None = None,
) -> EventoInstitucionRegla:
    if evento_institucion.reglas:
        regla = evento_institucion.reglas
        regla.min_participantes = min_participantes
        regla.max_participantes = max_participantes
        regla.observaciones = observaciones
    else:
        regla = EventoInstitucionRegla(
            evento_institucion_id=evento_institucion.id,
            min_participantes=min_participantes,
            max_participantes=max_participantes,
            observaciones=observaciones,
        )
        session.add(regla)
        evento_institucion.reglas = regla
    await session.flush()
    return regla


async def create_registration(
    session: AsyncSession,
    *,
    evento: Evento,
    evento_institucion: EventoInstitucion,
    categoria_id: int | None,
    nombre_equipo: str,
) -> EventoInscripcion:
    registration = EventoInscripcion(
        evento_id=evento.id,
        evento_institucion_id=evento_institucion.id,
        categoria_id=categoria_id,
        nombre_equipo=nombre_equipo,
    )
    session.add(registration)
    await session.flush()
    return registration


async def update_registration(
    session: AsyncSession,
    registration: EventoInscripcion,
    *,
    categoria_id: int | None = None,
    nombre_equipo: str | None = None,
    bloqueado: bool | None = None,
    aprobado: bool | None = None,
) -> EventoInscripcion:
    if categoria_id is not None:
        registration.categoria_id = categoria_id
    if nombre_equipo is not None:
        registration.nombre_equipo = nombre_equipo
    if bloqueado is not None:
        registration.bloqueado = bloqueado
    if aprobado is not None:
        registration.aprobado = aprobado
    await session.flush()
    return registration


async def delete_registration(session: AsyncSession, registration: EventoInscripcion) -> None:
    await session.delete(registration)
    await session.flush()

async def replace_registration_students(
    session: AsyncSession,
    registration: EventoInscripcion,
    estudiantes_ids: Iterable[int],
) -> None:
    desired = {int(student_id) for student_id in estudiantes_ids}

    # Cargar la relación de forma explícita
    await session.refresh(registration, attribute_names=["estudiantes"])

    current = {item.estudiante_id for item in registration.estudiantes}

    for item in list(registration.estudiantes):
        if item.estudiante_id not in desired:
            await session.delete(item)

    for student_id in desired - current:
        session.add(
            EventoInscripcionEstudiante(
                inscripcion_id=registration.id,
                estudiante_id=student_id,
            )
        )

    await session.flush()


async def delete_registration_students(session: AsyncSession, registration: EventoInscripcion) -> None:
    await session.execute(
        delete(EventoInscripcionEstudiante).where(
            EventoInscripcionEstudiante.inscripcion_id == registration.id
        )
    )
    await session.flush()


async def get_student_membership(
    session: AsyncSession,
    *,
    event_id: int,
    institucion_id: int,
    estudiante_id: int,
) -> EventoInscripcionEstudiante | None:
    query = (
        select(EventoInscripcionEstudiante)
        .options(
            selectinload(EventoInscripcionEstudiante.estudiante),
            selectinload(EventoInscripcionEstudiante.documentos)
            .selectinload(EventoInscripcionEstudianteDocumento.revisado_por),
            selectinload(EventoInscripcionEstudiante.inscripcion)
            .selectinload(EventoInscripcion.categoria),
        )
        .join(EventoInscripcion)
        .join(EventoInstitucion)
        .where(
            EventoInscripcion.evento_id == event_id,
            EventoInstitucion.institucion_id == institucion_id,
            EventoInscripcionEstudiante.estudiante_id == estudiante_id,
        )
    )
    result = await session.execute(query)
    return result.scalars().first()


async def list_student_memberships_by_ids(
    session: AsyncSession,
    *,
    event_id: int,
    institucion_id: int,
    estudiante_ids: Iterable[int],
) -> list[EventoInscripcionEstudiante]:
    ids = {int(student_id) for student_id in estudiante_ids if student_id is not None}
    if not ids:
        return []
    query = (
        select(EventoInscripcionEstudiante)
        .options(
            selectinload(EventoInscripcionEstudiante.estudiante),
            selectinload(EventoInscripcionEstudiante.documentos)
            .selectinload(EventoInscripcionEstudianteDocumento.revisado_por),
            selectinload(EventoInscripcionEstudiante.inscripcion)
            .selectinload(EventoInscripcion.categoria),
        )
        .join(EventoInscripcion)
        .join(EventoInstitucion)
        .where(
            EventoInscripcion.evento_id == event_id,
            EventoInstitucion.institucion_id == institucion_id,
            EventoInscripcionEstudiante.estudiante_id.in_(ids),
        )
    )
    result = await session.execute(query)
    return list(result.scalars().all())


async def upsert_student_document(
    session: AsyncSession,
    membership: EventoInscripcionEstudiante,
    *,
    tipo_documento: str,
    archivo_url: str,
) -> EventoInscripcionEstudianteDocumento:
    normalized = (tipo_documento or "").strip()
    if not normalized:
        raise ValueError("El tipo de documento es obligatorio")

    existing: EventoInscripcionEstudianteDocumento | None = None
    for document in getattr(membership, "documentos", []) or []:
        if (document.tipo_documento or "").strip().lower() == normalized.lower():
            existing = document
            break

    if existing:
        existing.archivo_url = archivo_url
        existing.tipo_documento = normalized
        existing.subido_en = datetime.now(timezone.utc)
        existing.estado_revision = "pendiente"
        existing.observaciones_revision = None
        existing.revisado_por_id = None
        existing.revisado_en = None
        target = existing
    else:
        target = EventoInscripcionEstudianteDocumento(
            estudiante_inscripcion_id=membership.id,
            tipo_documento=normalized,
            archivo_url=archivo_url,
            subido_en=datetime.now(timezone.utc),
            estado_revision="pendiente",
        )
        session.add(target)
        membership.documentos.append(target)

    await session.flush()
    return target


async def get_pending_student_document(
    session: AsyncSession,
    *,
    invitation_id: int,
    estudiante_id: int,
    tipo_documento: str,
) -> EventoInscripcionDocumentoPendiente | None:
    normalized = (tipo_documento or "").strip().lower()
    if not normalized:
        return None
    query = (
        select(EventoInscripcionDocumentoPendiente)
        .where(
            EventoInscripcionDocumentoPendiente.evento_institucion_id
            == invitation_id,
            EventoInscripcionDocumentoPendiente.estudiante_id == estudiante_id,
            func.lower(EventoInscripcionDocumentoPendiente.tipo_documento)
            == normalized,
        )
    )
    result = await session.execute(query)
    return result.scalars().first()


async def upsert_pending_student_document(
    session: AsyncSession,
    invitation: EventoInstitucion,
    *,
    estudiante_id: int,
    tipo_documento: str,
    archivo_url: str,
) -> EventoInscripcionDocumentoPendiente:
    normalized = (tipo_documento or "").strip()
    if not normalized:
        raise ValueError("El tipo de documento es obligatorio")

    existing = await get_pending_student_document(
        session,
        invitation_id=invitation.id,
        estudiante_id=estudiante_id,
        tipo_documento=normalized,
    )

    if existing:
        existing.archivo_url = archivo_url
        existing.tipo_documento = normalized
        existing.subido_en = datetime.now(timezone.utc)
        target = existing
    else:
        target = EventoInscripcionDocumentoPendiente(
            evento_institucion_id=invitation.id,
            estudiante_id=estudiante_id,
            tipo_documento=normalized,
            archivo_url=archivo_url,
            subido_en=datetime.now(timezone.utc),
        )
        session.add(target)

    await session.flush()
    return target


async def list_pending_student_documents(
    session: AsyncSession,
    *,
    invitation_id: int,
    student_ids: Iterable[int] | None = None,
) -> list[EventoInscripcionDocumentoPendiente]:
    query = select(EventoInscripcionDocumentoPendiente).where(
        EventoInscripcionDocumentoPendiente.evento_institucion_id == invitation_id
    )
    if student_ids is not None:
        ids = {int(student_id) for student_id in student_ids if student_id is not None}
        if not ids:
            return []
        query = query.where(
            EventoInscripcionDocumentoPendiente.estudiante_id.in_(ids)
        )
    result = await session.execute(query)
    return list(result.scalars().all())


async def delete_pending_student_document(
    session: AsyncSession, document: EventoInscripcionDocumentoPendiente
) -> None:
    await session.delete(document)
    await session.flush()


async def delete_pending_documents_for_invitation(
    session: AsyncSession, *, invitation_id: int
) -> None:
    await session.execute(
        delete(EventoInscripcionDocumentoPendiente).where(
            EventoInscripcionDocumentoPendiente.evento_institucion_id
            == invitation_id
        )
    )
    await session.flush()


async def update_student_document_review(
    session: AsyncSession,
    document: EventoInscripcionEstudianteDocumento,
    *,
    estado_revision: str,
    observaciones_revision: str | None,
    revisado_por_id: int | None,
) -> EventoInscripcionEstudianteDocumento:
    document.estado_revision = estado_revision
    document.observaciones_revision = observaciones_revision
    document.revisado_por_id = revisado_por_id
    document.revisado_en = datetime.now(timezone.utc)
    await session.flush()
    return document


async def create_audit_record(
    session: AsyncSession,
    *,
    evento: Evento,
    evento_institucion: EventoInstitucion,
    accion: str,
    motivo: str | None,
    actor_id: int | None,
) -> EventoAuditoria:
    record = EventoAuditoria(
        evento_id=evento.id,
        evento_institucion_id=evento_institucion.id,
        accion=accion,
        motivo=motivo,
        actor_id=actor_id,
    )
    session.add(record)
    await session.flush()
    return record


async def replace_fixture(
    session: AsyncSession,
    *,
    evento: Evento,
    partidos: Sequence[dict],
) -> None:
    await session.execute(
        delete(EventoPartido).where(EventoPartido.evento_id == evento.id)
    )
    for payload in partidos:
        session.add(EventoPartido(evento_id=evento.id, **payload))
    await session.flush()


async def list_fixture(session: AsyncSession, *, event_id: int) -> list[EventoPartido]:
    query = (
        select(EventoPartido)
        .options(
            selectinload(EventoPartido.escenario),
            selectinload(EventoPartido.categoria),
            selectinload(EventoPartido.equipo_local)
            .selectinload(EventoInscripcion.estudiantes)
            .selectinload(EventoInscripcionEstudiante.estudiante),
            selectinload(EventoPartido.equipo_local)
            .selectinload(EventoInscripcion.evento_institucion)
            .selectinload(EventoInstitucion.institucion),
            selectinload(EventoPartido.equipo_visitante)
            .selectinload(EventoInscripcion.estudiantes)
            .selectinload(EventoInscripcionEstudiante.estudiante),
            selectinload(EventoPartido.equipo_visitante)
            .selectinload(EventoInscripcion.evento_institucion)
            .selectinload(EventoInstitucion.institucion),
            selectinload(EventoPartido.ganador_inscripcion)
            .selectinload(EventoInscripcion.estudiantes)
            .selectinload(EventoInscripcionEstudiante.estudiante),
            selectinload(EventoPartido.ganador_inscripcion)
            .selectinload(EventoInscripcion.evento_institucion)
            .selectinload(EventoInstitucion.institucion),
        )
        .where(EventoPartido.evento_id == event_id)
        .order_by(EventoPartido.fecha, EventoPartido.hora)
    )
    result = await session.execute(query)
    return list(result.scalars().all())


async def get_match_by_id(
    session: AsyncSession, *, event_id: int, match_id: int
) -> EventoPartido | None:
    query = (
        select(EventoPartido)
        .options(
            selectinload(EventoPartido.equipo_local)
            .selectinload(EventoInscripcion.estudiantes)
            .selectinload(EventoInscripcionEstudiante.estudiante),
            selectinload(EventoPartido.equipo_local)
            .selectinload(EventoInscripcion.evento_institucion)
            .selectinload(EventoInstitucion.institucion),
            selectinload(EventoPartido.equipo_visitante)
            .selectinload(EventoInscripcion.estudiantes)
            .selectinload(EventoInscripcionEstudiante.estudiante),
            selectinload(EventoPartido.equipo_visitante)
            .selectinload(EventoInscripcion.evento_institucion)
            .selectinload(EventoInstitucion.institucion),
            selectinload(EventoPartido.ganador_inscripcion)
            .selectinload(EventoInscripcion.estudiantes)
            .selectinload(EventoInscripcionEstudiante.estudiante),
            selectinload(EventoPartido.ganador_inscripcion)
            .selectinload(EventoInscripcion.evento_institucion)
            .selectinload(EventoInstitucion.institucion),
        )
        .where(
            EventoPartido.evento_id == event_id,
            EventoPartido.id == match_id,
        )
    )
    result = await session.execute(query)
    return result.scalars().first()


async def propagate_match_result(
    session: AsyncSession,
    *,
    event_id: int,
    llave: str | None,
    ganador_id: int | None,
    perdedor_id: int | None,
) -> None:
    if not llave:
        return
    winner_tag = f"Ganador {llave}"
    loser_tag = f"Perdedor {llave}"
    query = select(EventoPartido).where(
        EventoPartido.evento_id == event_id,
        or_(
            EventoPartido.placeholder_local.in_([winner_tag, loser_tag]),
            EventoPartido.placeholder_visitante.in_([winner_tag, loser_tag]),
        ),
    )
    result = await session.execute(query)
    matches = list(result.scalars().all())
    for match in matches:
        if match.placeholder_local == winner_tag and ganador_id:
            match.equipo_local_id = ganador_id
            match.placeholder_local = None
        if match.placeholder_visitante == winner_tag and ganador_id:
            match.equipo_visitante_id = ganador_id
            match.placeholder_visitante = None
        if match.placeholder_local == loser_tag and perdedor_id:
            match.equipo_local_id = perdedor_id
            match.placeholder_local = None
        if match.placeholder_visitante == loser_tag and perdedor_id:
            match.equipo_visitante_id = perdedor_id
            match.placeholder_visitante = None
    await session.flush()
