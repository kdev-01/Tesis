from __future__ import annotations

from collections import OrderedDict
from datetime import date

from app.models.event import (
    Evento,
    EventoInscripcion,
    EventoInscripcionEstudiante,
    EventoPartido,
    EventoInstitucion,
)
from app.models.news import Noticia
from app.models.notification import Notificacion
from app.models.student import Estudiante
from app.models.institution import Institucion
from app.models.user import Usuario
from app.schemas.event import (
    Category,
    Event,
    EventInstitutionSummary,
    EventScenario,
    Sport,
)
from app.schemas.institution import Institution
from app.schemas.news import News
from app.schemas.notification import Notification, NotificationEventInfo
from app.schemas.student import Student
from app.schemas.user import UserBase
from app.services.file_service import resolve_media_path
from app.schemas.registration import (
    FixtureMatch,
    InvitationSummary,
    RegistrationSnapshot,
    RegistrationStudent,
    RegistrationStudentDocument,
    RegistrationTeam,
)

_REQUIRED_DOCUMENT_TYPES = {
    "matricula",
    "cedula_identidad",
    "autorizacion_representante",
}


def _extract_age_bounds(categories) -> tuple[int | None, int | None]:
    if not categories:
        return None, None

    bounds: list[tuple[int | None, int | None]] = []
    for category in categories:
        min_age = getattr(category, "edad_minima", None)
        max_age = getattr(category, "edad_maxima", None)
        if min_age is None and max_age is None:
            return None, None
        if min_age is not None or max_age is not None:
            bounds.append((min_age, max_age))

    if not bounds:
        return None, None

    min_age = min((item[0] for item in bounds if item[0] is not None), default=None)
    max_age = max((item[1] for item in bounds if item[1] is not None), default=None)
    return min_age, max_age


def map_user(user: Usuario) -> UserBase:
    roles = list(getattr(user, "roles", []) or [])
    role_names = [rol.nombre for rol in roles]
    role_ids = [rol.id for rol in roles]
    permisos = sorted({perm.permiso for rol in roles for perm in getattr(rol, "permisos", [])})
    institucion = getattr(user, "institucion", None)
    sport = getattr(user, "deporte", None)
    return UserBase(
        id=getattr(user, "id"),
        nombre_completo=getattr(user, "nombre_completo", None),
        email=getattr(user, "email"),
        telefono=getattr(user, "telefono", None),
        avatar_url=resolve_media_path(getattr(user, "avatar_url", None)),
        tipo_sangre=getattr(user, "tipo_sangre", None),
        activo=getattr(user, "activo", True),
        eliminado=getattr(user, "eliminado", False),
        roles=role_names,
        role_ids=role_ids,
        rol_id=role_ids[0] if role_ids else None,
        rol=role_names[0] if role_names else None,
        permisos=permisos,
        institucion_id=getattr(institucion, "id", None),
        institucion_nombre=getattr(institucion, "nombre", None),
        deporte_id=getattr(sport, "id", None),
        deporte_nombre=getattr(sport, "nombre", None),
        ultimo_acceso=getattr(user, "ultimo_acceso", None),
        creado_en=getattr(user, "creado_en", None),
        actualizado_en=getattr(user, "actualizado_en", None),
    )


def map_institution(institution: Institucion) -> Institution:
    schema = Institution.model_validate(institution)
    schema.portada_url = resolve_media_path(getattr(institution, "portada_url", None))
    return schema


def map_student(student: Estudiante) -> Student:
    schema = Student.model_validate(student)
    schema.foto_url = resolve_media_path(getattr(student, "foto_url", None))
    return schema


def map_event(event: Evento, *, include_institutions: bool = True) -> Event:
    instituciones = []
    if include_institutions:
        for invitacion in getattr(event, "instituciones_invitadas", []) or []:
            institucion = getattr(invitacion, "institucion", None)
            instituciones.append(
                EventInstitutionSummary(
                    institucion_id=invitacion.institucion_id,
                    nombre=getattr(institucion, "nombre", None),
                    email=getattr(institucion, "email", None),
                    estado_invitacion=getattr(invitacion, "estado_invitacion", None),
                )
            )

    sport = getattr(event, "deporte", None)
    sport_schema = Sport.model_validate(sport) if sport else None
    raw_categories = list(getattr(event, "categorias", []) or [])
    categories = [
        Category.model_validate(item)
        for item in raw_categories
        if item is not None
    ]
    min_age, max_age = _extract_age_bounds(raw_categories)
    scenarios: list[EventScenario] = []
    for event_scenario in getattr(event, "escenarios", []) or []:
        escenario = getattr(event_scenario, "escenario", None)
        scenarios.append(
            EventScenario(
                id=getattr(event_scenario, "id", None),
                escenario_id=getattr(event_scenario, "escenario_id", None),
                nombre_escenario=event_scenario.nombre_escenario,
                escenario_nombre=getattr(escenario, "nombre", None),
                escenario_direccion=getattr(escenario, "direccion", None),
            )
        )

    return Event(
        id=event.id,
        titulo=event.titulo,
        descripcion=event.descripcion,
        estado=event.estado,
        sexo_evento=event.sexo_evento,
        deporte=sport_schema,
        fecha_auditoria_inicio=_safe_date(event.fecha_auditoria_inicio),
        fecha_auditoria_fin=_safe_date(event.fecha_auditoria_fin),
        fecha_campeonato_inicio=_safe_date(event.fecha_campeonato_inicio),
        fecha_campeonato_fin=_safe_date(event.fecha_campeonato_fin),
        fecha_inscripcion_inicio=_safe_date(event.fecha_inscripcion_inicio),
        fecha_inscripcion_fin=_safe_date(event.fecha_inscripcion_fin),
        periodo_academico=event.periodo_academico,
        documento_planeacion_url=resolve_media_path(event.documento_planeacion),
        imagen_portada_url=resolve_media_path(event.imagen_portada),
        instituciones_invitadas=instituciones,
        categorias=categories,
        escenarios=scenarios,
        edad_minima_permitida=min_age,
        edad_maxima_permitida=max_age,
        eliminado=event.eliminado,
        creado_en=event.creado_en,
        actualizado_en=event.actualizado_en,
    )


def map_registration_student(
    item: EventoInscripcionEstudiante,
) -> RegistrationStudent:
    student = getattr(item, "estudiante", None)
    if not student:
        raise ValueError("La inscripción carece de información del estudiante")
    documents: list[RegistrationStudentDocument] = []
    for document in getattr(item, "documentos", []) or []:
        reviewer = getattr(document, "revisado_por", None)
        reviewer_name = None
        reviewer_id = getattr(document, "revisado_por_id", None)
        if reviewer is not None:
            reviewer_id = getattr(reviewer, "id", reviewer_id)
            reviewer_name = getattr(reviewer, "nombre_completo", None) or getattr(
                reviewer, "nombre", None
            )
        documents.append(
            RegistrationStudentDocument(
                id=document.id,
                tipo_documento=getattr(document, "tipo_documento", ""),
                archivo_url=getattr(document, "archivo_url", ""),
                subido_en=getattr(document, "subido_en", None),
                estado_revision=getattr(document, "estado_revision", None),
                observaciones_revision=getattr(
                    document, "observaciones_revision", None
                ),
                revisado_en=getattr(document, "revisado_en", None),
                revisado_por_id=reviewer_id,
                revisado_por_nombre=reviewer_name,
            )
        )
    return RegistrationStudent(
        id=student.id,
        nombres=student.nombres,
        apellidos=student.apellidos,
        documento_identidad=student.documento_identidad,
        genero=student.genero,
        fecha_nacimiento=student.fecha_nacimiento,
        foto_url=resolve_media_path(getattr(student, "foto_url", None)),
        activo=getattr(student, "activo", None),
        creado_en=getattr(student, "creado_en", None),
        documentos=documents,
    )


def map_registration_team(team: EventoInscripcion) -> RegistrationTeam:
    categoria = getattr(team, "categoria", None)
    category_schema = Category.model_validate(categoria) if categoria else None
    invitation = getattr(team, "evento_institucion", None)
    institution = getattr(invitation, "institucion", None)
    students = [
        map_registration_student(item)
        for item in getattr(team, "estudiantes", []) or []
    ]
    return RegistrationTeam(
        id=team.id,
        institucion_id=getattr(invitation, "institucion_id", None),
        institucion_nombre=getattr(institution, "nombre", None),
        categoria=category_schema,
        nombre_equipo=team.nombre_equipo,
        aprobado=team.aprobado,
        bloqueado=team.bloqueado,
        ultima_version_enviada_en=team.ultima_version_enviada_en,
        estudiantes=students,
    )


def map_invitation_summary(invitation: EventoInstitucion) -> InvitationSummary:
    event = getattr(invitation, "evento", None)
    sport = getattr(event, "deporte", None)
    sport_schema = Sport.model_validate(sport) if sport else None
    min_age, max_age = _extract_age_bounds(getattr(event, "categorias", []) or [])
    stage = _calculate_stage(
        registration_start=getattr(event, "fecha_inscripcion_inicio", None),
        registration_end=getattr(event, "fecha_inscripcion_fin", None),
        audit_start=getattr(event, "fecha_auditoria_inicio", None),
        audit_end=getattr(event, "fecha_auditoria_fin", None),
        championship_start=getattr(event, "fecha_campeonato_inicio", None),
        championship_end=getattr(event, "fecha_campeonato_fin", None),
        current_state=getattr(event, "estado", None),
    )
    registrations = getattr(invitation, "inscripciones", []) or []
    memberships: OrderedDict[int, EventoInscripcionEstudiante] = OrderedDict()
    for registration in registrations:
        for membership in getattr(registration, "estudiantes", []) or []:
            student = getattr(membership, "estudiante", None)
            if not student:
                continue
            student_id = getattr(student, "id", None)
            if student_id is None:
                continue
            if student_id not in memberships:
                memberships[student_id] = membership
    total_students = len(memberships)
    institution = getattr(invitation, "institucion", None)
    institution_name = getattr(institution, "nombre", None)
    institution_cover = resolve_media_path(getattr(institution, "portada_url", None))
    sexo_valido = True
    sexo_evento = (getattr(event, "sexo_evento", "") or "").upper()
    if sexo_evento and sexo_evento != "MX":
        for membership in memberships.values():
            student = getattr(membership, "estudiante", None)
            student_gender = (getattr(student, "genero", "") or "").upper()
            if student_gender != sexo_evento:
                sexo_valido = False
                break
    documentacion_completa: bool | None = None
    if memberships:
        documentacion_completa = True
        for membership in memberships.values():
            documents = {
                (getattr(document, "tipo_documento", "") or "").strip().lower()
                for document in getattr(membership, "documentos", []) or []
            }
            if not _REQUIRED_DOCUMENT_TYPES.issubset(documents):
                documentacion_completa = False
                break
    registration_deadline = getattr(invitation, "fecha_inscripcion_extendida", None) or getattr(
        event, "fecha_inscripcion_fin", None
    )
    return InvitationSummary(
        evento_id=invitation.evento_id,
        evento_institucion_id=getattr(invitation, "id", None),
        institucion_id=invitation.institucion_id,
        titulo=getattr(event, "titulo", ""),
        descripcion=getattr(event, "descripcion", None),
        deporte=sport_schema,
        sexo_evento=getattr(event, "sexo_evento", ""),
        estado_invitacion=invitation.estado_invitacion,
        estado_auditoria=invitation.estado_auditoria,
        habilitado_campeonato=invitation.habilitado_campeonato,
        fecha_inscripcion_inicio=getattr(event, "fecha_inscripcion_inicio", None),
        fecha_inscripcion_fin=registration_deadline,
        fecha_inscripcion_extendida=getattr(invitation, "fecha_inscripcion_extendida", None),
        etapa_actual=stage,
        cantidad_inscritos=total_students,
        institucion_nombre=institution_name,
        institucion_portada_url=institution_cover,
        ultima_version_enviada_en=invitation.ultima_version_enviada_en,
        motivo_rechazo=invitation.motivo_rechazo,
        sexo_valido=sexo_valido,
        documentacion_completa=documentacion_completa,
        edad_minima_permitida=min_age,
        edad_maxima_permitida=max_age,
    )


def map_registration_snapshot(invitation: EventoInstitucion) -> RegistrationSnapshot:
    event = getattr(invitation, "evento", None)
    stage = _calculate_stage(
        registration_start=getattr(event, "fecha_inscripcion_inicio", None),
        registration_end=getattr(event, "fecha_inscripcion_fin", None),
        audit_start=getattr(event, "fecha_auditoria_inicio", None),
        audit_end=getattr(event, "fecha_auditoria_fin", None),
        championship_start=getattr(event, "fecha_campeonato_inicio", None),
        championship_end=getattr(event, "fecha_campeonato_fin", None),
        current_state=getattr(event, "estado", None),
    )
    estado_auditoria = (getattr(invitation, "estado_auditoria", "") or "").lower()
    registration_deadline = getattr(invitation, "fecha_inscripcion_extendida", None) or getattr(
        event, "fecha_inscripcion_fin", None
    )
    allow_edit = (
        stage == "inscripcion"
        or (stage == "auditoria" and estado_auditoria in {"pendiente", "correccion"})
        or (registration_deadline is not None and date.today() <= registration_deadline)
    )
    students_map: OrderedDict[int, RegistrationStudent] = OrderedDict()
    for registration in getattr(invitation, "inscripciones", []) or []:
        for membership in getattr(registration, "estudiantes", []) or []:
            try:
                student_schema = map_registration_student(membership)
            except ValueError:
                continue
            if student_schema.id not in students_map:
                students_map[student_schema.id] = student_schema
    students = list(students_map.values())
    students.sort(key=lambda item: (
        (item.apellidos or "").lower(),
        (item.nombres or "").lower(),
    ))
    raw_categories = list(getattr(event, "categorias", []) or [])
    categories = [
        Category.model_validate(item)
        for item in raw_categories
        if item is not None
    ]
    min_age, max_age = _extract_age_bounds(raw_categories)

    return RegistrationSnapshot(
        evento_id=invitation.evento_id,
        institucion_id=invitation.institucion_id,
        estudiantes=students,
        etapa_actual=stage,
        fecha_inscripcion_fin=registration_deadline,
        fecha_inscripcion_extendida=getattr(invitation, "fecha_inscripcion_extendida", None),
        fecha_auditoria_fin=getattr(event, "fecha_auditoria_fin", None),
        estado_auditoria=getattr(invitation, "estado_auditoria", None),
        estado_invitacion=getattr(invitation, "estado_invitacion", None),
        mensaje_auditoria=getattr(invitation, "motivo_rechazo", None),
        ultima_revision_enviada_en=getattr(invitation, "ultima_version_enviada_en", None),
        sexo_evento=getattr(event, "sexo_evento", None),
        edicion_bloqueada=not allow_edit,
        categorias=categories,
        edad_minima_permitida=min_age,
        edad_maxima_permitida=max_age,
    )


def map_fixture_match(match: EventoPartido) -> FixtureMatch:
    escenario = getattr(match, "escenario", None)
    categoria = getattr(match, "categoria", None)
    local = getattr(match, "equipo_local", None)
    visitante = getattr(match, "equipo_visitante", None)
    winner_id = getattr(match, "ganador_inscripcion_id", None)
    local_score = getattr(match, "puntaje_local", None)
    visitor_score = getattr(match, "puntaje_visitante", None)
    local_result = None
    visitor_result = None
    if local_score is not None and visitor_score is not None:
        if local_score == visitor_score:
            local_result = visitor_result = "empate"
        elif winner_id:
            local_result = "ganado" if winner_id == getattr(match, "equipo_local_id", None) else "perdido"
            visitor_result = "ganado" if winner_id == getattr(match, "equipo_visitante_id", None) else "perdido"
        elif local_score > visitor_score:
            local_result, visitor_result = "ganado", "perdido"
        else:
            local_result, visitor_result = "perdido", "ganado"
    return FixtureMatch(
        id=match.id,
        fecha=match.fecha,
        hora=match.hora,
        hora_fin=getattr(match, "hora_fin", None),
        escenario_id=getattr(escenario, "id", match.escenario_evento_id),
        escenario_nombre=getattr(escenario, "nombre_escenario", None)
        or getattr(escenario, "nombre", None),
        categoria=Category.model_validate(categoria) if categoria else None,
        equipo_local=map_registration_team(local) if local else None,
        equipo_visitante=map_registration_team(visitante) if visitante else None,
        puntaje_local=getattr(match, "puntaje_local", None),
        puntaje_visitante=getattr(match, "puntaje_visitante", None),
        criterio_resultado=getattr(match, "criterio_resultado", None),
        ganador=map_registration_team(getattr(match, "ganador_inscripcion", None))
        if getattr(match, "ganador_inscripcion", None)
        else None,
        placeholder_local=getattr(match, "placeholder_local", None),
        placeholder_visitante=getattr(match, "placeholder_visitante", None),
        noticia_publicada=bool(getattr(match, "noticia_publicada", False)),
        fase=getattr(match, "fase", None),
        serie=getattr(match, "serie", None),
        ronda=match.ronda,
        llave=match.llave,
        observaciones=match.observaciones,
        estado=getattr(match, "estado", None),
        resultado_local=local_result,
        resultado_visitante=visitor_result,
    )


def _calculate_stage(
    *,
    registration_start: date | None,
    registration_end: date | None,
    audit_start: date | None,
    audit_end: date | None,
    championship_start: date | None,
    championship_end: date | None,
    reference_date: date | None = None,
    current_state: str | None = None,
) -> str:
    normalized_state = (current_state or "").strip().lower()
    if normalized_state == "archivado":
        return "archivado"
    today = reference_date or date.today()
    if not all(
        [
            registration_start,
            registration_end,
            audit_start,
            audit_end,
            championship_start,
            championship_end,
        ]
    ):
        return normalized_state or "borrador"
    if today < registration_start:
        return normalized_state or "borrador"
    if registration_start <= today <= registration_end:
        return "inscripcion"
    if audit_start <= today <= audit_end:
        return "auditoria"
    if championship_start <= today <= championship_end:
        return "campeonato"
    if today > championship_end:
        return "finalizado"
    return normalized_state or "borrador"


def _safe_date(value: date | None) -> date | None:
    return value if isinstance(value, date) else None


def map_news(news: Noticia) -> News:
    author = getattr(news, "autor", None)
    etiquetas = list(getattr(news, "etiquetas", []) or [])
    return News(
        id=news.id,
        titulo=news.titulo,
        slug=news.slug,
        resumen=news.resumen,
        contenido=news.contenido,
        categoria=news.categoria,
        etiquetas=etiquetas,
        estado=news.estado,
        destacado=news.destacado,
        orden=news.orden,
        fecha_publicacion=news.fecha_publicacion,
        autor_id=news.autor_id,
        autor=map_user(author) if author else None,
        creado_en=news.creado_en,
        actualizado_en=news.actualizado_en,
    )


def map_notification(notification: Notificacion) -> Notification:
    event = getattr(notification, "evento", None)
    sport = getattr(event, "deporte", None) if event else None
    event_info = (
        NotificationEventInfo(
            id=getattr(event, "id"),
            titulo=getattr(event, "titulo", ""),
            estado=getattr(event, "estado", None),
            deporte=getattr(sport, "nombre", None),
            fecha_inscripcion_inicio=getattr(event, "fecha_inscripcion_inicio", None),
            fecha_inscripcion_fin=getattr(event, "fecha_inscripcion_fin", None),
        )
        if event
        else None
    )
    metadata = getattr(notification, "metadata", None)
    metadata_dict = metadata if isinstance(metadata, dict) else None
    return Notification(
        id=notification.id,
        titulo=notification.titulo,
        mensaje=notification.mensaje,
        tipo=notification.tipo,
        nivel=notification.nivel,
        metadata=metadata_dict,
        evento=event_info,
        leido=notification.leido,
        leido_en=notification.leido_en,
        creado_en=notification.creado_en,
    )
