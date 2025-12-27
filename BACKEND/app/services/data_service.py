from __future__ import annotations

from collections.abc import Iterable, Sequence
from datetime import date, datetime, time, timedelta, timezone
from typing import Any, Sequence
import re
import unicodedata

from fastapi import UploadFile
from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import security
from app.core.config import settings
from app.core.exceptions import ApplicationError, ForbiddenError
from app.models.event import Evento, EventoInstitucion, EventoPartido
from app.models.registration import EventoInscripcion
from app.models.institution import Institucion
from app.models.student import Estudiante
from app.repositories import (
    config_repository,
    category_repository,
    event_repository,
    institution_repository,
    news_repository,
    notification_repository,
    role_repository,
    scenario_repository,
    sport_repository,
    student_repository,
    user_repository,
    registration_repository,
)
from app.schemas.configuration import AppConfigSchema
from app.schemas.catalog import (
    CategoryConfig,
    CategoryCreateRequest,
    CategoryUpdateRequest,
    SportConfig,
    SportCreateRequest,
    SportUpdateRequest,
)
from app.schemas.event import (
    Category,
    Event,
    EventCreate,
    EventUpdate,
    EventTimelineUpdate,
    EventScenarioPayload,
    Sport,
)
from app.schemas.history import HistoryFilters, HistoryRecord
from app.schemas.institution import (
    Institution,
    InstitutionCreate,
    InstitutionDisaffiliation,
    InstitutionReaffiliation,
    InstitutionSanction,
    InstitutionSanctionLift,
    InstitutionUpdate,
)
from app.schemas.news import News, NewsCreate, NewsStateUpdate, NewsUpdate, NEWS_STATES
from app.schemas.role import RoleBase, RoleCreate, RoleUpdate
from app.schemas.scenario import Scenario, ScenarioCreate, ScenarioUpdate
from app.schemas.student import Student, StudentCreate, StudentUpdate
from app.schemas.registration import (
    AuditDecisionBatchPayload,
    AuditDecisionPayload,
    FixtureMatch,
    FixturePayload,
    MatchResultPayload,
    StandingRow,
    StandingTable,
    InvitationSummary,
    InvitationNotificationPayload,
    InvitationNotificationResult,
    RegistrationExtensionPayload,
    RegistrationPayload,
    RegistrationSnapshot,
    RegistrationStudentDocument,
    StudentDocumentBatchResult,
    StudentDocumentBatchSummary,
    StudentDocumentBatchUpload,
    StudentDocumentUploadStatus,
    StudentDocumentReviewPayload,
    StudentDocumentType,
    EventInstitutionCreate,
)
from app.schemas.schedule import ScheduleRequest
from app.schemas.user import UserBase, UserCreate, UserProfileUpdate, UserUpdate
import app.services.scheduling_service as scheduling_service
from app.services import audit_service, file_service
from app.services.email_service import email_service
from app.services.mappers import (
    map_event,
    map_institution,
    map_invitation_summary,
    map_news,
    map_registration_snapshot,
    map_fixture_match,
    map_student,
    map_user,
)
from app.services.scheduling_service import (
    ScheduleConfig,
    collect_eligible_registrations,
    compute_group_standings,
    determine_tournament_structure,
    persist_schedule,
    persist_additional_matches,
    resolve_seed_team,
    schedule_stage_matches,
    Team,
    update_event_config,
)
from app.services.password_service import password_service

_REQUIRED_STUDENT_DOCUMENTS: dict[str, str] = {
    "matricula": "Matrícula de la institución",
    "cedula_identidad": "Copia de cédula de identidad",
    "autorizacion_representante": "Autorización del representante legal",
}

_DOCUMENT_TYPE_ALIASES: dict[str, str] = {
    "matricula_institucion": "matricula",
    "matricula": "matricula",
    "cedula": "cedula_identidad",
    "cedula_identidad": "cedula_identidad",
    "copia_cedula": "cedula_identidad",
    "autorizacion": "autorizacion_representante",
    "permiso_representante": "autorizacion_representante",
    "autorizacion_representante": "autorizacion_representante",
}


_ALLOWED_DOCUMENT_REVIEW_STATES = {"pendiente", "aprobado", "correccion"}


_ALLOWED_EVENT_STATES = {
    "borrador",
    "inscripcion",
    "auditoria",
    "campeonato",
    "finalizado",
    "archivado",
}


def _is_pdf_upload(upload: UploadFile | None) -> bool:
    if not upload:
        return False
    content_type = (upload.content_type or "").lower()
    if content_type in {"application/pdf", "application/x-pdf", "application/acrobat"}:
        return True
    filename = (upload.filename or "").lower()
    return filename.endswith(".pdf")


def _normalize_student_document_type(value: str) -> str:
    normalized = (
        unicodedata.normalize("NFKD", value or "")
        .encode("ascii", "ignore")
        .decode()
        .lower()
    )
    normalized = re.sub(r"[^a-z]+", "_", normalized).strip("_")
    if normalized in _DOCUMENT_TYPE_ALIASES:
        return _DOCUMENT_TYPE_ALIASES[normalized]
    if normalized in _REQUIRED_STUDENT_DOCUMENTS:
        return normalized
    raise ApplicationError("Tipo de documento no reconocido", status_code=400)


def _normalize_document_review_state(value: str | None) -> str:
    normalized = (value or "pendiente").strip().lower()
    if normalized not in _ALLOWED_DOCUMENT_REVIEW_STATES:
        raise ApplicationError("Estado de revisión no válido", status_code=400)
    return normalized


def list_student_document_types() -> list[StudentDocumentType]:
    return [
        StudentDocumentType(id=key, etiqueta=value)
        for key, value in _REQUIRED_STUDENT_DOCUMENTS.items()
    ]



def _normalize_role_name(value: str | None) -> str:
    return (value or "").strip().lower()


def _is_commissioner_role(value: str | None) -> bool:
    return _normalize_role_name(value) == "representante de comisión"


def _is_commissioner_user(user: UserBase | None) -> bool:
    return bool(
        user and any(_is_commissioner_role(role) for role in getattr(user, "roles", []))
    )


def _is_admin_role(value: str | None) -> bool:
    return _normalize_role_name(value) == "administrador"


def _is_admin_user(user: UserBase | None) -> bool:
    return bool(user and any(_is_admin_role(role) for role in getattr(user, "roles", [])))


def _is_educational_representative_role(value: str | None) -> bool:
    return _normalize_role_name(value) == "representante educativo"


def _is_educational_representative(user: UserBase | None) -> bool:
    return bool(
        user
        and any(
            _is_educational_representative_role(role)
            for role in getattr(user, "roles", [])
        )
    )


def _resolve_commissioner_sport(actor: UserBase) -> int:
    sport_id = getattr(actor, "deporte_id", None)
    if sport_id is None:
        raise ApplicationError(
            "Tu usuario no tiene un deporte asignado",
            status_code=400,
        )
    return int(sport_id)



async def list_users(
    session: AsyncSession,
    *,
    page: int,
    page_size: int,
    search: str | None = None,
    include_deleted: bool = True,
    roles: list[str] | None = None,
    institucion_id: int | None = None,
    unassigned_only: bool = False,
) -> tuple[list[UserBase], int]:
    users, total = await user_repository.list_users(
        session,
        page=page,
        page_size=page_size,
        search=search,
        include_deleted=include_deleted,
        role_names=roles,
        institucion_id=institucion_id,
        unassigned_only=unassigned_only,
    )
    return [map_user(u) for u in users], total


async def create_user(
    session: AsyncSession, payload: UserCreate, *, actor: UserBase | None = None
) -> UserBase:
    existing = await user_repository.get_user_by_email(session, payload.email, include_deleted=True)
    if existing:
        raise ApplicationError("Ya existe un usuario con ese correo electrónico")

    role = await role_repository.get_role_by_id(session, payload.rol_id)
    if not role:
        raise ApplicationError("El rol seleccionado no existe")

    institucion_id = payload.institucion_id
    if institucion_id:
        institution = await institution_repository.get_institution_by_id(session, institucion_id)
        if not institution:
            raise ApplicationError("La institución seleccionada no existe")

    sport = None
    if payload.deporte_id is not None:
        sport = await sport_repository.get_sport_by_id(session, payload.deporte_id)
        if not sport:
            raise ApplicationError("El deporte seleccionado no es válido o está inactivo")
    if _is_commissioner_role(getattr(role, "nombre", None)):
        if sport is None:
            raise ApplicationError(
                "Debes asignar un deporte al representante de comisión",
                status_code=400,
            )

    user = await user_repository.create_user(
        session,
        nombre_completo=payload.nombre_completo,
        email=payload.email,
        telefono=payload.telefono,
        tipo_sangre=payload.tipo_sangre,
        activo=payload.activo,
        hash_password=security.hash_password(payload.password),
        avatar_url=payload.avatar_url,
        roles=[role],
        institucion_id=institucion_id,
        deporte_id=getattr(sport, "id", None),
    )
    await audit_service.log_event(
        session,
        entidad="usuarios",
        accion="creado",
        descripcion=f"Se creó el usuario {payload.nombre_completo}",
        actor=actor,
        entidad_id=user.id,
        metadata={
            "email": payload.email,
            "rol": role.nombre,
            "deporte": getattr(sport, "nombre", None),
        },
    )
    await session.commit()
    await session.refresh(user)

    if payload.send_welcome:
        base_url = settings.frontend_base_url.rstrip("/")
        access_url = f"{base_url}/acceso"
        await email_service.send_welcome_email(
            to=user.email,
            name=user.nombre_completo,
            access_url=access_url,
        )

    return map_user(user)


async def update_user(
    session: AsyncSession,
    user_id: int,
    payload: UserUpdate,
    *,
    actor: UserBase | None = None,
) -> UserBase:
    user = await user_repository.get_user_by_id(session, user_id, include_deleted=True)
    if not user:
        raise ApplicationError("Usuario no encontrado", status_code=404)
    if user.eliminado:
        raise ApplicationError("No es posible editar un usuario eliminado", status_code=400)

    fields_set = getattr(payload, "model_fields_set", set())
    telefono_set = "telefono" in fields_set
    tipo_sangre_set = "tipo_sangre" in fields_set
    if payload.email and payload.email != user.email:
        other = await user_repository.get_user_by_email(session, payload.email, include_deleted=True)
        if other and other.id != user.id:
            raise ApplicationError("Ya existe un usuario con ese correo electrónico")

    roles = None
    institucion_provided = "institucion_id" in fields_set
    requested_institution_id = payload.institucion_id if institucion_provided else user.institucion_id
    sport_provided = "deporte_id" in fields_set
    requested_sport_id = payload.deporte_id if sport_provided else user.deporte_id
    sport = None
    if payload.rol_id is not None:
        role = await role_repository.get_role_by_id(session, payload.rol_id)
        if not role:
            raise ApplicationError("El rol seleccionado no existe")
        roles = [role]
        if institucion_provided and requested_institution_id:
            institution = await institution_repository.get_institution_by_id(
                session, requested_institution_id
            )
            if not institution:
                raise ApplicationError("La institución seleccionada no existe")
    elif institucion_provided and requested_institution_id:
        institution = await institution_repository.get_institution_by_id(
            session, requested_institution_id
        )
        if not institution:
            raise ApplicationError("La institución seleccionada no existe")

    effective_role = (roles[0] if roles else user.roles[0]) if user.roles or roles else None
    deporte_id_value: int | None = None
    if _is_commissioner_role(getattr(effective_role, "nombre", None)):
        if requested_sport_id is None:
            raise ApplicationError(
                "Debes asignar un deporte al representante de comisión",
                status_code=400,
            )
        sport = await sport_repository.get_sport_by_id(session, requested_sport_id)
        if not sport:
            raise ApplicationError("El deporte seleccionado no es válido o está inactivo")
        if sport_provided or user.deporte_id is None:
            deporte_id_value = sport.id
            sport_provided = True
    elif sport_provided:
        if requested_sport_id is None:
            deporte_id_value = None
        else:
            sport = await sport_repository.get_sport_by_id(session, requested_sport_id)
            if not sport:
                raise ApplicationError("El deporte seleccionado no es válido o está inactivo")
            deporte_id_value = sport.id

    hash_password = security.hash_password(payload.password) if payload.password else None
    previous_avatar = user.avatar_url
    clear_avatar = bool(payload.remove_avatar)

    await user_repository.update_user(
        session,
        user,
        nombre_completo=payload.nombre_completo,
        email=payload.email,
        telefono=payload.telefono,
        telefono_set=telefono_set,
        tipo_sangre=payload.tipo_sangre,
        tipo_sangre_set=tipo_sangre_set,
        activo=payload.activo,
        hash_password=hash_password,
        avatar_url=payload.avatar_url,
        roles=roles,
        institucion_id=payload.institucion_id if institucion_provided else None,
        institucion_id_set=institucion_provided,
        clear_avatar=clear_avatar,
        deporte_id=deporte_id_value,
        deporte_id_set=sport_provided,
    )
    user.actualizado_en = datetime.now(timezone.utc)
    await audit_service.log_event(
        session,
        entidad="usuarios",
        accion="actualizado",
        descripcion=f"Se actualizaron los datos de {user.nombre_completo}",
        actor=actor,
        entidad_id=user.id,
        metadata={
            "email": user.email,
            "rol": getattr(effective_role, "nombre", None),
            "deporte": getattr(sport, "nombre", None)
            if sport
            else (user.deporte.nombre if getattr(user, "deporte", None) else None),
        },
    )
    await session.commit()
    await session.refresh(user)

    if clear_avatar and previous_avatar:
        file_service.delete_media(previous_avatar)
    elif payload.avatar_url and previous_avatar and payload.avatar_url != previous_avatar:
        file_service.delete_media(previous_avatar)
    return map_user(user)


async def delete_user(
    session: AsyncSession, user_id: int, *, actor: UserBase | None = None
) -> None:
    user = await user_repository.get_user_by_id(session, user_id, include_deleted=True)
    if not user:
        raise ApplicationError("Usuario no encontrado", status_code=404)
    if user.eliminado:
        raise ApplicationError("El usuario ya se encuentra eliminado", status_code=400)
    await user_repository.soft_delete_user(session, user)
    await audit_service.log_event(
        session,
        entidad="usuarios",
        accion="eliminado",
        descripcion=f"Se eliminó temporalmente el usuario {user.nombre_completo}",
        actor=actor,
        entidad_id=user.id,
        metadata={"email": user.email},
        severidad="warning",
    )
    await session.commit()


async def restore_user(
    session: AsyncSession, user_id: int, *, actor: UserBase | None = None
) -> UserBase:
    user = await user_repository.get_user_by_id(session, user_id, include_deleted=True)
    if not user:
        raise ApplicationError("Usuario no encontrado", status_code=404)
    if not user.eliminado:
        raise ApplicationError("El usuario no está eliminado", status_code=400)
    await user_repository.restore_user(session, user)
    await audit_service.log_event(
        session,
        entidad="usuarios",
        accion="restaurado",
        descripcion=f"Se restauró el usuario {user.nombre_completo}",
        actor=actor,
        entidad_id=user.id,
        metadata={"email": user.email},
    )
    await session.commit()
    await session.refresh(user)
    return map_user(user)


async def delete_user_permanently(
    session: AsyncSession, user_id: int, *, actor: UserBase | None = None
) -> None:
    user = await user_repository.get_user_by_id(session, user_id, include_deleted=True)
    if not user:
        raise ApplicationError("Usuario no encontrado", status_code=404)
    await user_repository.hard_delete_user(session, user)
    await audit_service.log_event(
        session,
        entidad="usuarios",
        accion="eliminado_definitivamente",
        descripcion=f"Se eliminó permanentemente el usuario {user.nombre_completo}",
        actor=actor,
        entidad_id=user.id,
        metadata={"email": user.email},
        severidad="danger",
    )
    await session.commit()


async def send_account_recovery(session: AsyncSession, user_id: int) -> None:
    user = await user_repository.get_user_by_id(session, user_id)
    if not user:
        raise ApplicationError("Usuario no encontrado", status_code=404)
    await password_service.request_reset(session, email=user.email)


async def update_profile(session: AsyncSession, user_id: int, payload: UserProfileUpdate) -> UserBase:
    user = await user_repository.get_user_by_id(session, user_id)
    if not user:
        raise ApplicationError("Usuario no encontrado", status_code=404)

    hash_password = None
    if payload.password_nueva:
        if not payload.password_actual or not security.verify_password(payload.password_actual, user.hash_password):
            raise ApplicationError(
                "La contraseña actual no es válida",
                status_code=400,
            )
        hash_password = security.hash_password(payload.password_nueva)

    previous_avatar = user.avatar_url
    clear_avatar = bool(payload.remove_avatar)
    fields_set = getattr(payload, "model_fields_set", set())

    await user_repository.update_user(
        session,
        user,
        nombre_completo=payload.nombre_completo,
        telefono=payload.telefono,
        telefono_set="telefono" in fields_set,
        tipo_sangre=payload.tipo_sangre,
        tipo_sangre_set="tipo_sangre" in fields_set,
        hash_password=hash_password,
        avatar_url=payload.avatar_url,
        clear_avatar=clear_avatar,
    )
    await session.commit()
    await session.refresh(user)

    if clear_avatar and previous_avatar:
        file_service.delete_media(previous_avatar)
    elif payload.avatar_url and previous_avatar and payload.avatar_url != previous_avatar:
        file_service.delete_media(previous_avatar)
    return map_user(user)


async def list_institutions(
    session: AsyncSession,
    *,
    page: int,
    page_size: int,
    search: str | None = None,
    include_deleted: bool = False,
    actor: UserBase | None = None,
) -> tuple[list[Institution], int]:
    if _is_educational_representative(actor):
        if not getattr(actor, "institucion_id", None):
            raise ApplicationError(
                "Tu usuario no está asociado a una institución", status_code=400
            )
        institution_id = int(actor.institucion_id)
        institutions = await institution_repository.get_institutions_by_ids(
            session, [institution_id]
        )
        mapped = [map_institution(inst) for inst in institutions]
        return mapped, len(mapped)

    institutions, total = await institution_repository.list_institutions(
        session,
        page=page,
        page_size=page_size,
        search=search,
        include_deleted=include_deleted,
    )
    return [map_institution(inst) for inst in institutions], total


async def create_institution(
    session: AsyncSession, payload: InstitutionCreate, *, actor: UserBase | None = None
) -> Institution:
    existing = await institution_repository.get_institution_by_name(
        session, payload.nombre, include_deleted=True
    )
    if existing:
        raise ApplicationError("Ya existe una institución con ese nombre")
    if payload.email:
        other = await institution_repository.get_institution_by_email(
            session, payload.email, include_deleted=True
        )
        if other:
            raise ApplicationError("Ya existe una institución con ese correo electrónico")
    institution = await institution_repository.create_institution(
        session,
        nombre=payload.nombre,
        descripcion=payload.descripcion,
        direccion=payload.direccion,
        ciudad=payload.ciudad,
        email=payload.email,
        telefono=payload.telefono,
        portada_url=payload.portada_url,
        estado=payload.estado,
    )
    await audit_service.log_event(
        session,
        entidad="instituciones",
        accion="creada",
        descripcion=f"Se registró la institución {payload.nombre}",
        actor=actor,
        entidad_id=institution.id,
        metadata={"estado": payload.estado},
    )
    await session.commit()
    await session.refresh(institution)
    return map_institution(institution)


async def get_institution(
    session: AsyncSession, institution_id: int, *, actor: UserBase | None = None
) -> Institution:
    institution = await institution_repository.get_institution_by_id(
        session, institution_id
    )
    if not institution or institution.eliminado:
        raise ApplicationError("Institución no encontrada", status_code=404)
    if _is_educational_representative(actor):
        if not getattr(actor, "institucion_id", None):
            raise ApplicationError(
                "Tu usuario no está asociado a una institución", status_code=400
            )
        if int(actor.institucion_id) != int(institution_id):
            raise ForbiddenError()
    return map_institution(institution)


async def update_institution(
    session: AsyncSession,
    institution_id: int,
    payload: InstitutionUpdate,
    *,
    actor: UserBase | None = None,
) -> Institution:
    institution = await institution_repository.get_institution_by_id(session, institution_id)
    if not institution:
        raise ApplicationError("Institución no encontrada", status_code=404)
    if institution.eliminado:
        raise ApplicationError("No es posible actualizar una institución eliminada", status_code=400)

    if _is_educational_representative(actor):
        if not getattr(actor, "institucion_id", None):
            raise ApplicationError(
                "Tu usuario no está asociado a una institución", status_code=400
            )
        if int(actor.institucion_id) != int(institution_id):
            raise ForbiddenError()

    fields_set = getattr(payload, "model_fields_set", set())
    if payload.nombre and payload.nombre.lower() != institution.nombre.lower():
        existing = await institution_repository.get_institution_by_name(
            session, payload.nombre, include_deleted=True
        )
        if existing and existing.id != institution.id:
            raise ApplicationError("Ya existe una institución con ese nombre")
    if payload.email is not None or "email" in fields_set:
        if payload.email:
            other = await institution_repository.get_institution_by_email(
                session, payload.email, include_deleted=True
            )
            if other and other.id != institution.id:
                raise ApplicationError("Ya existe una institución con ese correo electrónico")
        elif "email" in fields_set:
            # Permitir limpiar el correo electrónico
            payload.email = None

    previous_portada = institution.portada_url
    clear_portada = bool(payload.remove_portada)

    estado_value = payload.estado if not _is_educational_representative(actor) else None

    await institution_repository.update_institution(
        session,
        institution,
        nombre=payload.nombre,
        descripcion=payload.descripcion,
        direccion=payload.direccion,
        ciudad=payload.ciudad,
        email=payload.email,
        telefono=payload.telefono,
        portada_url=payload.portada_url,
        estado=estado_value,
        clear_portada=clear_portada,
    )
    await audit_service.log_event(
        session,
        entidad="instituciones",
        accion="actualizada",
        descripcion=f"Se actualizaron los datos de {institution.nombre}",
        actor=actor,
        entidad_id=institution.id,
        metadata={"estado": payload.estado or institution.estado},
    )
    await session.commit()
    await session.refresh(institution)

    if clear_portada and previous_portada:
        file_service.delete_media(previous_portada)
    elif payload.portada_url and previous_portada and payload.portada_url != previous_portada:
        file_service.delete_media(previous_portada)
    return map_institution(institution)


async def delete_institution(
    session: AsyncSession, institution_id: int, *, actor: UserBase | None = None
) -> None:
    institution = await institution_repository.get_institution_by_id(session, institution_id)
    if not institution:
        raise ApplicationError("Institución no encontrada", status_code=404)
    if institution.eliminado:
        raise ApplicationError("La institución ya se encuentra eliminada", status_code=400)
    await institution_repository.logical_delete_institution(
        session, institution, actor_id=actor.id if actor else None
    )
    await audit_service.log_event(
        session,
        entidad="instituciones",
        accion="eliminada",
        descripcion=f"Se eliminó temporalmente la institución {institution.nombre}",
        actor=actor,
        entidad_id=institution.id,
        metadata={"estado": institution.estado},
        severidad="warning",
    )
    await session.commit()


async def restore_institution(
    session: AsyncSession, institution_id: int, *, actor: UserBase | None = None
) -> Institution:
    institution = await institution_repository.get_institution_by_id(session, institution_id)
    if not institution:
        raise ApplicationError("Institución no encontrada", status_code=404)
    if not institution.eliminado:
        raise ApplicationError("La institución no está eliminada", status_code=400)
    await institution_repository.restore_institution(session, institution)
    await audit_service.log_event(
        session,
        entidad="instituciones",
        accion="restaurada",
        descripcion=f"Se restauró la institución {institution.nombre}",
        actor=actor,
        entidad_id=institution.id,
        metadata={"estado": institution.estado},
    )
    await session.commit()
    await session.refresh(institution)
    return map_institution(institution)


async def delete_institution_permanently(
    session: AsyncSession, institution_id: int, *, actor: UserBase | None = None
) -> None:
    institution = await institution_repository.get_institution_by_id(session, institution_id)
    if not institution:
        raise ApplicationError("Institución no encontrada", status_code=404)
    previous_portada = institution.portada_url
    await institution_repository.hard_delete_institution(session, institution)
    await audit_service.log_event(
        session,
        entidad="instituciones",
        accion="eliminada_definitivamente",
        descripcion=f"Se eliminó permanentemente la institución {institution.nombre}",
        actor=actor,
        entidad_id=institution.id,
        metadata={},
        severidad="danger",
    )
    await session.commit()
    if previous_portada:
        file_service.delete_media(previous_portada)


async def disaffiliate_institution(
    session: AsyncSession, institution_id: int, payload: InstitutionDisaffiliation
) -> Institution:
    institution = await institution_repository.get_institution_by_id(session, institution_id)
    if not institution:
        raise ApplicationError("Institución no encontrada", status_code=404)
    await institution_repository.disaffiliate_institution(session, institution, motivo=payload.motivo)
    await session.commit()
    await session.refresh(institution)
    return map_institution(institution)


async def reaffiliate_institution(
    session: AsyncSession, institution_id: int, _: InstitutionReaffiliation | None = None
) -> Institution:
    institution = await institution_repository.get_institution_by_id(session, institution_id)
    if not institution:
        raise ApplicationError("Institución no encontrada", status_code=404)
    await institution_repository.reaffiliate_institution(session, institution)
    await session.commit()
    await session.refresh(institution)
    return map_institution(institution)


async def apply_institution_sanction(
    session: AsyncSession, institution_id: int, payload: InstitutionSanction
) -> Institution:
    institution = await institution_repository.get_institution_by_id(session, institution_id)
    if not institution:
        raise ApplicationError("Institución no encontrada", status_code=404)

    inicio = payload.fecha_inicio or datetime.now(timezone.utc)
    fin = payload.fecha_fin
    if fin and fin < inicio:
        raise ApplicationError("La fecha de fin de la sanción no puede ser anterior al inicio")

    await institution_repository.apply_institution_sanction(
        session,
        institution,
        motivo=payload.motivo,
        tipo=payload.tipo,
        inicio=inicio,
        fin=fin,
    )
    await session.commit()
    await session.refresh(institution)
    return map_institution(institution)


async def lift_institution_sanction(
    session: AsyncSession, institution_id: int, _: InstitutionSanctionLift | None = None
) -> Institution:
    institution = await institution_repository.get_institution_by_id(session, institution_id)
    if not institution:
        raise ApplicationError("Institución no encontrada", status_code=404)
    if not institution.sancion_activa:
        raise ApplicationError("La institución no tiene una sanción activa", status_code=400)
    await institution_repository.clear_institution_sanction(session, institution)
    await session.commit()
    await session.refresh(institution)
    return map_institution(institution)


async def list_students(
    session: AsyncSession,
    *,
    page: int,
    page_size: int,
    search: str | None = None,
    institucion_id: int | None = None,
    unassigned_only: bool = False,
    include_deleted: bool = False,
    actor: UserBase | None = None,
) -> tuple[list[Student], int]:
    target_institution = institucion_id
    include_removed = include_deleted
    unassigned_flag = unassigned_only
    

    if _is_educational_representative(actor):
        actor_institution = getattr(actor, "institucion_id", None)
        if not actor_institution:
            raise ApplicationError(
                "Tu usuario no está asociado a una institución", status_code=400
            )
        if target_institution is not None and int(target_institution) != int(actor_institution):
            raise ForbiddenError()
        if unassigned_flag:
            raise ForbiddenError()
        target_institution = int(actor_institution)
        include_removed = False

    students, total = await student_repository.list_students(
        session,
        page=page,
        page_size=page_size,
        search=search,
        institucion_id=target_institution,
        unassigned_only=unassigned_flag,
        include_deleted=include_removed,
    )
    print("+=========================================================================")
    print(students)

    return [map_student(student) for student in students], total


async def create_student(
    session: AsyncSession, payload: StudentCreate, *, actor: UserBase | None = None
) -> Student:
    target_institution_id = payload.institucion_id
    if _is_educational_representative(actor):
        actor_institution = getattr(actor, "institucion_id", None)
        if not actor_institution:
            raise ApplicationError(
                "Tu usuario no está asociado a una institución", status_code=400
            )
        if target_institution_id is not None and int(target_institution_id) != int(actor_institution):
            raise ForbiddenError()
        target_institution_id = int(actor_institution)

    institution = None
    if target_institution_id is not None:
        institution = await institution_repository.get_institution_by_id(
            session, target_institution_id
        )
        if not institution:
            raise ApplicationError("La institución seleccionada no existe", status_code=404)

    if payload.documento_identidad:
        existing_student = await student_repository.get_student_by_document(
            session,
            payload.documento_identidad,
            institucion_id=target_institution_id,
            include_deleted=True,
        )
        if existing_student:
            raise ApplicationError(
                "Ya existe un estudiante con ese documento de identidad en la institución seleccionada"
            )

    student = await student_repository.create_student(
        session,
        institucion_id=target_institution_id,
        nombres=payload.nombres,
        apellidos=payload.apellidos,
        documento_identidad=payload.documento_identidad,
        foto_url=payload.foto_url,
        fecha_nacimiento=payload.fecha_nacimiento,
        genero=payload.genero,
        activo=payload.activo,
    )
    await audit_service.log_event(
        session,
        entidad="estudiantes",
        accion="creado",
        descripcion=f"Se registró al estudiante {payload.nombres} {payload.apellidos}",
        actor=actor,
        entidad_id=student.id,
        metadata={
            "institucion_id": target_institution_id,
            "documento": payload.documento_identidad,
        },
    )
    await session.commit()
    await session.refresh(student)
    return map_student(student)


async def update_student(
    session: AsyncSession,
    student_id: int,
    payload: StudentUpdate,
    *,
    actor: UserBase | None = None,
) -> Student:
    student = await student_repository.get_student_by_id(
        session, student_id, include_deleted=True
    )
    if not student:
        raise ApplicationError("Estudiante no encontrado", status_code=404)
    if student.eliminado:
        raise ApplicationError("No es posible actualizar un estudiante eliminado", status_code=400)

    fields_set = getattr(payload, "model_fields_set", set())
    institucion_set = "institucion_id" in fields_set
    if _is_educational_representative(actor):
        actor_institution = getattr(actor, "institucion_id", None)
        if not actor_institution:
            raise ApplicationError(
                "Tu usuario no está asociado a una institución", status_code=400
            )
        if student.institucion_id is None or int(student.institucion_id) != int(actor_institution):
            raise ForbiddenError()
        if institucion_set:
            if payload.institucion_id is None or int(payload.institucion_id) != int(actor_institution):
                raise ForbiddenError()
        institucion_set = False
    target_institution_id = (
        payload.institucion_id if institucion_set else student.institucion_id
    )
    if institucion_set and payload.institucion_id is not None:
        institution = await institution_repository.get_institution_by_id(
            session, payload.institucion_id
        )
        if not institution:
            raise ApplicationError("La institución seleccionada no existe", status_code=404)

    if payload.documento_identidad is not None:
        if payload.documento_identidad:
            existing_student = await student_repository.get_student_by_document(
                session,
                payload.documento_identidad,
                institucion_id=target_institution_id,
                include_deleted=True,
            )
            if existing_student and existing_student.id != student.id:
                raise ApplicationError(
                    "Ya existe un estudiante con ese documento de identidad en la institución seleccionada"
                )
        else:
            payload.documento_identidad = None

    previous_foto = student.foto_url
    clear_foto = bool(payload.remove_foto)

    await student_repository.update_student(
        session,
        student,
        institucion_id=payload.institucion_id if institucion_set else None,
        institucion_id_set=institucion_set,
        nombres=payload.nombres,
        apellidos=payload.apellidos,
        documento_identidad=payload.documento_identidad,
        foto_url=payload.foto_url,
        fecha_nacimiento=payload.fecha_nacimiento,
        genero=payload.genero,
        activo=payload.activo,
        clear_foto=clear_foto,
    )
    await audit_service.log_event(
        session,
        entidad="estudiantes",
        accion="actualizado",
        descripcion=f"Se actualizaron los datos de {student.nombres} {student.apellidos}",
        actor=actor,
        entidad_id=student.id,
        metadata={"institucion_id": student.institucion_id},
    )
    await session.commit()
    await session.refresh(student)

    if clear_foto and previous_foto:
        file_service.delete_media(previous_foto)
    elif payload.foto_url and previous_foto and payload.foto_url != previous_foto:
        file_service.delete_media(previous_foto)

    return map_student(student)


async def delete_student(
    session: AsyncSession, student_id: int, *, actor: UserBase | None = None
) -> None:
    student = await student_repository.get_student_by_id(
        session, student_id, include_deleted=True
    )
    if not student:
        raise ApplicationError("Estudiante no encontrado", status_code=404)
    if student.eliminado:
        raise ApplicationError("El estudiante ya se encuentra eliminado", status_code=400)
    if _is_educational_representative(actor):
        actor_institution = getattr(actor, "institucion_id", None)
        if not actor_institution:
            raise ApplicationError(
                "Tu usuario no está asociado a una institución", status_code=400
            )
        if student.institucion_id is None or int(student.institucion_id) != int(actor_institution):
            raise ForbiddenError()

    await student_repository.soft_delete_student(
        session, student, actor_id=actor.id if actor else None
    )
    await audit_service.log_event(
        session,
        entidad="estudiantes",
        accion="eliminado",
        descripcion=f"Se eliminó al estudiante {student.nombres} {student.apellidos}",
        actor=actor,
        entidad_id=student.id,
        metadata={"institucion_id": student.institucion_id},
        severidad="warning",
    )
    await session.commit()


async def restore_student(
    session: AsyncSession, student_id: int, *, actor: UserBase | None = None
) -> Student:
    student = await student_repository.get_student_by_id(
        session, student_id, include_deleted=True
    )
    if not student:
        raise ApplicationError("Estudiante no encontrado", status_code=404)
    if not student.eliminado:
        raise ApplicationError("El estudiante no está eliminado", status_code=400)
    if _is_educational_representative(actor):
        actor_institution = getattr(actor, "institucion_id", None)
        if not actor_institution:
            raise ApplicationError(
                "Tu usuario no está asociado a una institución", status_code=400
            )
        if student.institucion_id is None or int(student.institucion_id) != int(actor_institution):
            raise ForbiddenError()

    await student_repository.restore_student(session, student)
    await audit_service.log_event(
        session,
        entidad="estudiantes",
        accion="restaurado",
        descripcion=f"Se restauró al estudiante {student.nombres} {student.apellidos}",
        actor=actor,
        entidad_id=student.id,
        metadata={"institucion_id": student.institucion_id},
    )
    await session.commit()
    await session.refresh(student)
    return map_student(student)


async def delete_student_permanently(
    session: AsyncSession, student_id: int, *, actor: UserBase | None = None
) -> None:
    student = await student_repository.get_student_by_id(
        session, student_id, include_deleted=True
    )
    if not student:
        raise ApplicationError("Estudiante no encontrado", status_code=404)
    if _is_educational_representative(actor):
        actor_institution = getattr(actor, "institucion_id", None)
        if not actor_institution:
            raise ApplicationError(
                "Tu usuario no está asociado a una institución", status_code=400
            )
        if student.institucion_id is None or int(student.institucion_id) != int(actor_institution):
            raise ForbiddenError()

    previous_foto = student.foto_url
    await student_repository.hard_delete_student(session, student)
    await audit_service.log_event(
        session,
        entidad="estudiantes",
        accion="eliminado_definitivamente",
        descripcion=f"Se eliminó permanentemente al estudiante {student.nombres} {student.apellidos}",
        actor=actor,
        entidad_id=student.id,
        metadata={"institucion_id": student.institucion_id},
        severidad="danger",
    )
    await session.commit()

    if previous_foto:
        file_service.delete_media(previous_foto)


async def list_selectable_institutions(session: AsyncSession) -> list[Institution]:
    institutions = await institution_repository.list_selectable_institutions(session)
    return [map_institution(item) for item in institutions]


async def list_events(
    session: AsyncSession,
    *,
    page: int,
    page_size: int,
    search: str | None = None,
    deporte_id: int | None = None,
    actor: UserBase | None = None,
) -> tuple[list[Event], int]:
    sport_filter = None
    if deporte_id is not None:
        sport_filter = int(deporte_id)
    if _is_commissioner_user(actor):
        sport_filter = _resolve_commissioner_sport(actor)
    events, total = await event_repository.list_events(
        session,
        page=page,
        page_size=page_size,
        search=search,
        deporte_id=sport_filter,
    )
    return [_map_event_with_stage(event) for event in events], total


async def get_event_detail(
    session: AsyncSession,
    *,
    event_id: int,
    actor: UserBase | None = None,
    include_institutions: bool = True,
) -> Event:
    event = await event_repository.get_event_by_id(
        session, event_id, include_institutions=include_institutions
    )
    if not event or event.eliminado:
        raise ApplicationError("Evento no encontrado", status_code=404)
    if _is_commissioner_user(actor):
        allowed_sport = _resolve_commissioner_sport(actor)
        if int(event.deporte_id) != int(allowed_sport):
            raise ForbiddenError()
    return _map_event_with_stage(
        event, include_institutions=include_institutions
    )


async def list_sports(
    session: AsyncSession, *, actor: UserBase | None = None
) -> list[Sport]:
    if _is_commissioner_user(actor):
        sport_id = _resolve_commissioner_sport(actor)
        sports = await sport_repository.get_sports_by_ids(session, [sport_id])
    else:
        sports = await sport_repository.list_sports(session)
    return [Sport.model_validate(item) for item in sports]


async def list_categories_by_sport(
    session: AsyncSession,
    *,
    deporte_id: int,
    actor: UserBase | None = None,
) -> list[Category]:
    if _is_commissioner_user(actor):
        sport_id = _resolve_commissioner_sport(actor)
        if int(sport_id) != int(deporte_id):
            raise ForbiddenError()
    categories = await category_repository.list_categories(
        session, deporte_id=deporte_id
    )
    return [Category.model_validate(item) for item in categories]


def _validate_event_schedule(
    *,
    registration_start: date | None,
    registration_end: date | None,
    audit_start: date | None,
    audit_end: date | None,
    championship_start: date | None,
    championship_end: date | None,
) -> None:
    if not registration_start or not registration_end:
        raise ApplicationError(
            "Debes especificar tanto la fecha de apertura como la de cierre de inscripciones"
        )
    if registration_start >= registration_end:
        raise ApplicationError(
            "La fecha de apertura de inscripciones debe ser anterior al cierre"
        )
    if not audit_start or not audit_end:
        raise ApplicationError("Debes especificar las fechas de auditoría del evento")
    if audit_start >= audit_end:
        raise ApplicationError(
            "La fecha de inicio de auditoría debe ser anterior al fin de auditoría"
        )
    if audit_start <= registration_end:
        raise ApplicationError(
            "La auditoría debe iniciar después de que finalicen las inscripciones"
        )
    if audit_end <= registration_end:
        raise ApplicationError(
            "La auditoría debe finalizar después del periodo de inscripciones"
        )
    if not championship_start or not championship_end:
        raise ApplicationError("Debes especificar las fechas del campeonato")
    if championship_start >= championship_end:
        raise ApplicationError(
            "La fecha de inicio del campeonato debe ser anterior a la fecha de finalización"
        )
    if audit_end >= championship_start:
        raise ApplicationError(
            "El campeonato debe iniciar después de que termine la auditoría. Ajusta también la fecha del torneo si necesitas extender la auditoría"
        )


def _calculate_event_stage(
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
        return "borrador"
    if registration_start <= today <= registration_end:
        return "inscripcion"
    if audit_start <= today <= audit_end:
        return "auditoria"
    if championship_start <= today <= championship_end:
        return "campeonato"
    if today > championship_end:
        return "finalizado"
    return "borrador"


def _is_phase_complete(matches: Sequence[EventoPartido], phase: str) -> bool:
    normalized = phase.lower()
    phase_matches = [
        match
        for match in matches
        if (getattr(match, "fase", "") or "").lower() == normalized
        or (normalized == "final" and (getattr(match, "fase", "") or "").lower() == "third_place")
    ]
    if not phase_matches:
        return False
    return all((getattr(match, "estado", "") or "").lower() == "finalizado" for match in phase_matches)


def _resolve_next_stage(
    structure: scheduling_service.TournamentStructure,
    matches: Sequence[EventoPartido],
) -> str | None:
    sequence = scheduling_service.resolve_stage_sequence(structure.playoff_teams)
    if not matches:
        return sequence[0]
    for idx, phase in enumerate(sequence):
        phase_matches = [
            match
            for match in matches
            if (getattr(match, "fase", "") or "").lower() == phase
            or (phase == "final" and (getattr(match, "fase", "") or "").lower() == "third_place")
        ]
        if not phase_matches:
            prev_phase = sequence[idx - 1] if idx > 0 else None
            if prev_phase is None or _is_phase_complete(matches, prev_phase):
                return phase
            return None
        if not _is_phase_complete(matches, phase):
            return None
    return None


def _build_schedule_meta(
    structure: scheduling_service.TournamentStructure,
    matches: Sequence[EventoPartido],
) -> dict:
    return {
        "next_stage": _resolve_next_stage(structure, matches),
        "completed_phases": [
            phase
            for phase in scheduling_service.resolve_stage_sequence(
                structure.playoff_teams
            )
            if _is_phase_complete(matches, phase)
        ],
        "has_results": any(
            (getattr(match, "estado", "") or "").lower() == "finalizado"
            for match in matches
        ),
    }


def _resolve_effective_registration_end(
    invitation: EventoInstitucion, event: Evento
) -> date | None:
    general_end = getattr(event, "fecha_inscripcion_fin", None)
    extension = getattr(invitation, "fecha_inscripcion_extendida", None)
    audit_end = getattr(event, "fecha_auditoria_fin", None)
    if extension and audit_end and extension > audit_end:
        extension = audit_end
    if extension and general_end and extension < general_end:
        extension = general_end
    return extension or general_end


def _can_edit_institution_registration(
    invitation: EventoInstitucion, event: Evento, stage: str
) -> bool:
    audit_state = (getattr(invitation, "estado_auditoria", "") or "").lower()
    effective_registration_end = _resolve_effective_registration_end(invitation, event)
    today = date.today()
    if stage == "inscripcion":
        return effective_registration_end is None or today <= effective_registration_end
    if stage == "auditoria" and audit_state in {"pendiente", "correccion"}:
        return True
    return bool(effective_registration_end and today <= effective_registration_end)


def _normalize_event_state(value: str | None, *, fallback: str = "borrador") -> str:
    normalized = (value or "").strip().lower()
    if normalized in _ALLOWED_EVENT_STATES:
        return normalized
    return fallback


def _resolve_event_state(stage: str | None, current_state: str | None) -> str:
    normalized_stage = _normalize_event_state(stage)
    normalized_current = _normalize_event_state(current_state)
    if normalized_current == "archivado":
        return "archivado"
    if normalized_stage == "archivado":
        return "archivado"
    if normalized_stage in _ALLOWED_EVENT_STATES:
        return normalized_stage
    return normalized_current or "borrador"


def _collect_institution_recipients(
    institution: Institucion | None,
) -> list[tuple[str | None, str]]:
    if not institution:
        return []

    recipients: list[tuple[str | None, str]] = []
    if getattr(institution, "email", None):
        recipients.append((institution.nombre, institution.email))

    for representative in getattr(institution, "representantes", []) or []:
        if not getattr(representative, "email", None):
            continue
        if getattr(representative, "eliminado", False):
            continue
        if getattr(representative, "activo", False) is False:
            continue
        role_names = {
            (getattr(role, "nombre", "") or "").strip().lower()
            for role in getattr(representative, "roles", []) or []
        }
        if "representante educativo" not in role_names:
            continue
        recipients.append((representative.nombre_completo, representative.email))
    return recipients


def _collect_educational_representatives(
    institution: Institucion | None,
) -> list[object]:
    if not institution:
        return []
    representatives: list[object] = []
    for representative in getattr(institution, "representantes", []) or []:
        if getattr(representative, "eliminado", False):
            continue
        if getattr(representative, "activo", True) is False:
            continue
        role_names = {
            (getattr(role, "nombre", "") or "").strip().lower()
            for role in getattr(representative, "roles", []) or []
        }
        if "representante educativo" not in role_names:
            continue
        representatives.append(representative)
    return representatives


def _resolve_actor_name(actor: UserBase | None) -> str:
    if not actor:
        return "Un usuario del sistema"
    if getattr(actor, "nombre_completo", None):
        return str(actor.nombre_completo)
    if getattr(actor, "email", None):
        return str(actor.email)
    if getattr(actor, "id", None) is not None:
        return f"Usuario #{actor.id}"
    return "Un usuario del sistema"


def _build_event_admin_url(event_id: int) -> str:
    base = settings.frontend_base_url.rstrip("/")
    return f"{base}/admin/eventos/{event_id}/detalle"


def _build_registration_manager_url(
    event_id: int, institucion_id: int | None = None
) -> str:
    base = settings.frontend_base_url.rstrip("/")
    url = f"{base}/admin/eventos/inscripcion?evento={event_id}"
    if institucion_id:
        url += f"&institucion={institucion_id}"
    return url


def _get_document_label(document_type: str) -> str:
    normalized = (document_type or "").strip().lower()
    mapped = _REQUIRED_STUDENT_DOCUMENTS.get(normalized)
    if mapped:
        return mapped
    return normalized.replace("_", " ").title() or "Documento"


async def _list_commissioners_for_event(
    session: AsyncSession, event: Evento
) -> list[object]:
    sport_id = getattr(event, "deporte_id", None)
    if sport_id is None:
        return []
    users = await user_repository.list_commissioners_by_sport(
        session, sport_id=int(sport_id)
    )
    return list(users or [])


async def _notify_commissioners_registration_activity(
    session: AsyncSession,
    *,
    event: Evento,
    institution: Institucion,
    actor: UserBase | None,
    action_date: datetime,
    change_type: str,
    message_suffix: str,
    metadata_extra: dict[str, Any] | None = None,
    level: str = "info",
) -> None:
    if not _is_educational_representative(actor):
        return
    commissioners = await _list_commissioners_for_event(session, event)
    if not commissioners:
        return
    actor_name = _resolve_actor_name(actor)
    institution_name = getattr(institution, "nombre", None) or "la institución"
    message = f"{actor_name} {message_suffix} de {institution_name}."
    metadata: dict[str, Any] = {
        "evento_id": getattr(event, "id", None),
        "institucion_id": getattr(institution, "id", None),
        "tipo_cambio": change_type,
        "registrado_en": action_date.isoformat(),
        "actor_id": getattr(actor, "id", None),
        "actor_nombre": actor_name,
    }
    if metadata_extra:
        metadata.update(metadata_extra)
    portal_url = _build_event_admin_url(event.id)
    actor_id = getattr(actor, "id", None)
    for commissioner in commissioners:
        user_id = getattr(commissioner, "id", None)
        if user_id is None or user_id == actor_id:
            continue
        payload = dict(metadata)
        payload["destinatario_id"] = user_id
        await notification_repository.create_notification(
            session,
            usuario_id=int(user_id),
            titulo=f"Actualización de inscripción · {event.titulo}",
            mensaje=message,
            tipo="evento",
            nivel=level,
            metadata=payload,
            evento_id=event.id,
        )
        email_address = getattr(commissioner, "email", None)
        if email_address:
            email_service.enqueue_event_registration_update(
                to=email_address,
                recipient_name=getattr(commissioner, "nombre_completo", None),
                event_title=event.titulo,
                institution_name=getattr(institution, "nombre", None),
                actor_name=actor_name,
                action_date=action_date,
                portal_url=portal_url,
            )


async def _notify_institution_audit_activity(
    session: AsyncSession,
    *,
    event: Evento,
    institution: Institucion,
    actor: UserBase | None,
    action_date: datetime,
    change_type: str,
    message: str,
    metadata_extra: dict[str, Any] | None = None,
    level: str = "info",
) -> None:
    recipients = _collect_educational_representatives(institution)
    if not recipients:
        return
    actor_name = _resolve_actor_name(actor)
    metadata: dict[str, Any] = {
        "evento_id": getattr(event, "id", None),
        "institucion_id": getattr(institution, "id", None),
        "tipo_cambio": change_type,
        "registrado_en": action_date.isoformat(),
        "actor_id": getattr(actor, "id", None),
        "actor_nombre": actor_name,
    }
    if metadata_extra:
        metadata.update(metadata_extra)
    portal_url = _build_registration_manager_url(
        event.id, getattr(institution, "id", None)
    )
    actor_id = getattr(actor, "id", None)
    for representative in recipients:
        user_id = getattr(representative, "id", None)
        if user_id is None or user_id == actor_id:
            continue
        payload = dict(metadata)
        payload["destinatario_id"] = user_id
        await notification_repository.create_notification(
            session,
            usuario_id=int(user_id),
            titulo=f"Novedades de auditoría · {event.titulo}",
            mensaje=message,
            tipo="evento",
            nivel=level,
            metadata=payload,
            evento_id=event.id,
        )
        email_address = getattr(representative, "email", None)
        if email_address:
            email_service.enqueue_event_audit_update(
                to=email_address,
                recipient_name=getattr(representative, "nombre_completo", None),
                event_title=event.titulo,
                institution_name=getattr(institution, "nombre", None),
                actor_name=actor_name,
                action_date=action_date,
                change_description=message,
                portal_url=portal_url,
            )
async def _apply_pending_student_documents(
    session: AsyncSession,
    invitation: EventoInstitucion,
    *,
    student_ids: Iterable[int],
) -> tuple[int, list[str]]:
    pending_documents = await registration_repository.list_pending_student_documents(
        session,
        invitation_id=invitation.id,
        student_ids=student_ids,
    )
    if not pending_documents:
        return 0, []

    memberships = await registration_repository.list_student_memberships_by_ids(
        session,
        event_id=invitation.evento_id,
        institucion_id=invitation.institucion_id,
        estudiante_ids=[doc.estudiante_id for doc in pending_documents],
    )
    memberships_by_student = {
        membership.estudiante_id: membership for membership in memberships
    }

    attached = 0
    previous_paths: list[str] = []

    for pending in pending_documents:
        membership = memberships_by_student.get(pending.estudiante_id)
        if not membership:
            continue
        normalized_type = _normalize_student_document_type(pending.tipo_documento)
        existing_path = None
        for document in getattr(membership, "documentos", []) or []:
            if (document.tipo_documento or "").strip().lower() == normalized_type:
                existing_path = document.archivo_url
                break
        updated = await registration_repository.upsert_student_document(
            session,
            membership,
            tipo_documento=normalized_type,
            archivo_url=pending.archivo_url,
        )
        await registration_repository.delete_pending_student_document(session, pending)
        attached += 1
        if existing_path and existing_path != updated.archivo_url:
            previous_paths.append(existing_path)

    return attached, previous_paths


async def _get_event_institution(
    session: AsyncSession, event_id: int, institucion_id: int
):
    invitation = await registration_repository.get_event_institution(
        session, event_id=event_id, institucion_id=institucion_id
    )
    if not invitation:
        raise ApplicationError(
            "La institución no está invitada a este evento", status_code=404
        )
    event = getattr(invitation, "evento", None)
    if not event or event.eliminado:
        raise ApplicationError("Evento no disponible", status_code=404)
    return invitation


def _map_event_with_stage(
    event: Evento,
    *,
    reference_date: date | None = None,
    include_institutions: bool = True,
) -> Event:
    schema = map_event(event, include_institutions=include_institutions)
    stage = _calculate_event_stage(
        registration_start=event.fecha_inscripcion_inicio,
        registration_end=event.fecha_inscripcion_fin,
        audit_start=event.fecha_auditoria_inicio,
        audit_end=event.fecha_auditoria_fin,
        championship_start=event.fecha_campeonato_inicio,
        championship_end=event.fecha_campeonato_fin,
        reference_date=reference_date,
        current_state=event.estado,
    )
    resolved_state = _resolve_event_state(stage, event.estado)
    return schema.model_copy(update={"etapa_actual": stage, "estado": resolved_state})


async def create_event(
    session: AsyncSession,
    *,
    administrador_id: int,
    payload: EventCreate,
    planning_document: UploadFile | None = None,
    cover_image: UploadFile | None = None,
    actor: UserBase | None = None,
) -> Event:
    titulo = (payload.titulo or "").strip()
    if not titulo:
        raise ApplicationError("El título del evento es obligatorio")

    sport = await sport_repository.get_sport_by_id(session, payload.deporte_id)
    if not sport:
        raise ApplicationError("El deporte seleccionado no es válido o está inactivo")
    if _is_commissioner_user(actor):
        commissioner_sport = _resolve_commissioner_sport(actor)
        if int(commissioner_sport) != int(sport.id):
            raise ForbiddenError()

    category_ids = [int(value) for value in payload.categorias or [] if value is not None]
    category_ids = list(dict.fromkeys(category_ids))
    if not category_ids:
        raise ApplicationError("Selecciona al menos una categoría para el evento")

    categories = await category_repository.get_categories_by_ids(session, category_ids)
    if len(categories) != len(category_ids):
        raise ApplicationError("Una o más categorías seleccionadas no son válidas")

    invalid_categories = [
        item.nombre for item in categories if int(item.deporte_id) != int(sport.id)
    ]
    if invalid_categories:
        raise ApplicationError(
            "Las siguientes categorías no pertenecen al deporte seleccionado: "
            + ", ".join(invalid_categories)
        )

    periodo_academico = str(datetime.now(timezone.utc).year)

    _validate_event_schedule(
        registration_start=payload.fecha_inscripcion_inicio,
        registration_end=payload.fecha_inscripcion_fin,
        audit_start=payload.fecha_auditoria_inicio,
        audit_end=payload.fecha_auditoria_fin,
        championship_start=payload.fecha_campeonato_inicio,
        championship_end=payload.fecha_campeonato_fin,
    )

    scenario_payloads = payload.escenarios or []
    sanitized_scenarios: list[EventScenarioPayload] = []
    seen_pairs: set[tuple[int | None, str]] = set()
    for scenario in scenario_payloads:
        name = scenario.nombre_escenario.strip()
        pair = (scenario.escenario_id, name.lower())
        if pair in seen_pairs:
            raise ApplicationError(
                "No puedes registrar el mismo escenario más de una vez para el evento"
            )
        seen_pairs.add(pair)
        if scenario.escenario_id is not None:
            db_scenario = await scenario_repository.get_scenario_by_id(
                session, scenario.escenario_id
            )
            if not db_scenario or not db_scenario.activo:
                raise ApplicationError(
                    "Uno de los escenarios seleccionados no está disponible"
                )
        sanitized_scenarios.append(scenario)

    invited_ids = list(dict.fromkeys(payload.instituciones_invitadas or []))
    institutions = await institution_repository.get_selectable_institutions_by_ids(session, invited_ids)
    if len(institutions) != len(invited_ids):
        raise ApplicationError("Una o más instituciones invitadas no son seleccionables")

    estado = _normalize_event_state(payload.estado)

    planning_path: str | None = None
    cover_path: str | None = None
    try:
        if planning_document:
            planning_path = await file_service.save_document(
                planning_document, folder="events/documents"
            )
        if cover_image:
            cover_path = await file_service.save_image(cover_image, folder="events/images")
    except Exception:
        file_service.delete_media(planning_path)
        file_service.delete_media(cover_path)
        raise

    event = await event_repository.create_event(
        session,
        administrador_id=administrador_id,
        titulo=titulo,
        descripcion=payload.descripcion,
        estado=estado,
        sexo_evento=payload.sexo_evento,
        deporte_id=sport.id,
        fecha_auditoria_inicio=payload.fecha_auditoria_inicio,
        fecha_auditoria_fin=payload.fecha_auditoria_fin,
        fecha_campeonato_inicio=payload.fecha_campeonato_inicio,
        fecha_campeonato_fin=payload.fecha_campeonato_fin,
        fecha_inscripcion_inicio=payload.fecha_inscripcion_inicio,
        fecha_inscripcion_fin=payload.fecha_inscripcion_fin,
        periodo_academico=periodo_academico,
        documento_planeacion=planning_path,
        imagen_portada=cover_path,
        categorias=categories,
        escenarios=[scenario.model_dump() for scenario in sanitized_scenarios],
    )


    event = await event_repository.get_event_by_id(session, event.id)

    if invited_ids:
        await event_repository.replace_invited_institutions(session, event, invited_ids)

    await session.commit()

    # y después, si quieres, reléelo de nuevo (opcional; ya viene “gordo”)
    event = await event_repository.get_event_by_id(session, event.id)

    created_event = _map_event_with_stage(event)

    portal_base = settings.frontend_base_url.rstrip("/")
    portal_url = f"{portal_base}/eventos/{event.id}"
    planning_url = created_event.documento_planeacion_url
    if planning_url and not planning_url.startswith("http"):
        planning_url = f"{portal_base}{planning_url}"

    for institution in institutions:
        recipients = _collect_institution_recipients(institution)

        seen_emails: set[str] = set()
        for recipient_name, email in recipients:
            normalized_email = email.strip().lower()
            if not normalized_email or normalized_email in seen_emails:
                continue
            seen_emails.add(normalized_email)
            email_service.enqueue_event_created(
                to=email,
                institution_name=recipient_name or institution.nombre,
                event_title=created_event.titulo,
                start_date=
                created_event.fecha_campeonato_inicio
                or created_event.fecha_auditoria_inicio
                or created_event.fecha_inscripcion_inicio,
                end_date=
                created_event.fecha_campeonato_fin
                or created_event.fecha_auditoria_fin
                or created_event.fecha_inscripcion_fin,
                planning_url=planning_url,
                portal_url=portal_url,
            )

    return created_event


async def update_event(
    session: AsyncSession,
    *,
    event_id: int,
    payload: EventUpdate,
    planning_document: UploadFile | None = None,
    cover_image: UploadFile | None = None,
    actor: UserBase | None = None,
) -> Event:
    event = await event_repository.get_event_by_id(session, event_id)
    if not event or event.eliminado:
        raise ApplicationError("Evento no encontrado", status_code=404)

    periodo_academico = event.periodo_academico or str(datetime.now(timezone.utc).year)

    allowed_sport: int | None = None
    if _is_commissioner_user(actor):
        allowed_sport = _resolve_commissioner_sport(actor)
        if int(event.deporte_id) != int(allowed_sport):
            raise ForbiddenError()

    updated_sport_id: int | None = None
    if payload.deporte_id is not None:
        sport = await sport_repository.get_sport_by_id(session, payload.deporte_id)
        if not sport:
            raise ApplicationError("El deporte seleccionado no es válido o está inactivo")
        if allowed_sport is not None and int(sport.id) != int(allowed_sport):
            raise ForbiddenError()
        updated_sport_id = sport.id

    effective_sport_id = updated_sport_id or event.deporte_id

    updated_categories = None
    if payload.categorias is not None:
        category_ids = [int(value) for value in payload.categorias if value is not None]
        category_ids = list(dict.fromkeys(category_ids))
        if not category_ids:
            raise ApplicationError("Selecciona al menos una categoría para el evento")
        updated_categories = await category_repository.get_categories_by_ids(
            session, category_ids
        )
        if len(updated_categories) != len(category_ids):
            raise ApplicationError("Una o más categorías seleccionadas no son válidas")
        invalid_categories = [
            item.nombre for item in updated_categories if int(item.deporte_id) != int(effective_sport_id)
        ]
        if invalid_categories:
            raise ApplicationError(
                "Las siguientes categorías no pertenecen al deporte seleccionado: "
                + ", ".join(invalid_categories)
            )
    elif updated_sport_id is not None:
        raise ApplicationError(
            "Debes seleccionar categorías compatibles cuando cambias el deporte del evento"
        )

    updated_scenarios = None
    if payload.escenarios is not None:
        sanitized_scenarios: list[dict[str, int | str | None]] = []
        seen_pairs: set[tuple[int | None, str]] = set()
        for scenario in payload.escenarios:
            name = scenario.nombre_escenario.strip()
            pair = (scenario.escenario_id, name.lower())
            if pair in seen_pairs:
                raise ApplicationError(
                    "No puedes registrar el mismo escenario más de una vez para el evento"
                )
            seen_pairs.add(pair)
            if scenario.escenario_id is not None:
                db_scenario = await scenario_repository.get_scenario_by_id(
                    session, scenario.escenario_id
                )
                if not db_scenario or not db_scenario.activo:
                    raise ApplicationError(
                        "Uno de los escenarios seleccionados no está disponible"
                    )
            sanitized_scenarios.append(
                {
                    "escenario_id": scenario.escenario_id,
                    "nombre_escenario": name,
                }
            )
        updated_scenarios = sanitized_scenarios

    invited_ids = None
    institutions = None
    if payload.instituciones_invitadas is not None:
        invited_ids = list(dict.fromkeys(payload.instituciones_invitadas))
        institutions = await institution_repository.get_selectable_institutions_by_ids(session, invited_ids)
        if len(institutions) != len(invited_ids):
            raise ApplicationError("Una o más instituciones invitadas no son seleccionables")

    remove_cover_image = bool(payload.remove_cover_image)
    new_planning: str | None = None
    new_cover: str | None = None
    try:
        if planning_document:
            new_planning = await file_service.save_document(
                planning_document, folder="events/documents"
            )
        if cover_image:
            new_cover = await file_service.save_image(cover_image, folder="events/images")
    except Exception:
        file_service.delete_media(new_planning)
        file_service.delete_media(new_cover)
        raise

    previous_planning = event.documento_planeacion if new_planning else None
    previous_cover = None
    if new_cover:
        previous_cover = event.imagen_portada
    elif remove_cover_image:
        previous_cover = event.imagen_portada

    final_registration_start = (
        payload.fecha_inscripcion_inicio
        if payload.fecha_inscripcion_inicio is not None
        else event.fecha_inscripcion_inicio
    )
    final_registration_end = (
        payload.fecha_inscripcion_fin
        if payload.fecha_inscripcion_fin is not None
        else event.fecha_inscripcion_fin
    )
    final_audit_start = (
        payload.fecha_auditoria_inicio
        if payload.fecha_auditoria_inicio is not None
        else event.fecha_auditoria_inicio
    )
    final_audit_end = (
        payload.fecha_auditoria_fin
        if payload.fecha_auditoria_fin is not None
        else event.fecha_auditoria_fin
    )
    final_championship_start = (
        payload.fecha_campeonato_inicio
        if payload.fecha_campeonato_inicio is not None
        else event.fecha_campeonato_inicio
    )
    final_championship_end = (
        payload.fecha_campeonato_fin
        if payload.fecha_campeonato_fin is not None
        else event.fecha_campeonato_fin
    )

    _validate_event_schedule(
        registration_start=final_registration_start,
        registration_end=final_registration_end,
        audit_start=final_audit_start,
        audit_end=final_audit_end,
        championship_start=final_championship_start,
        championship_end=final_championship_end,
    )

    await event_repository.update_event(
        session,
        event,
        titulo=payload.titulo,
        descripcion=payload.descripcion,
        sexo_evento=payload.sexo_evento,
        deporte_id=updated_sport_id,
        fecha_auditoria_inicio=final_audit_start,
        fecha_auditoria_fin=final_audit_end,
        fecha_campeonato_inicio=final_championship_start,
        fecha_campeonato_fin=final_championship_end,
        fecha_inscripcion_inicio=final_registration_start,
        fecha_inscripcion_fin=final_registration_end,
        estado=_normalize_event_state(
            payload.estado if isinstance(payload.estado, str) else event.estado,
            fallback=event.estado,
        ),
        documento_planeacion=new_planning if new_planning is not None else None,
        imagen_portada=new_cover if new_cover is not None else None,
        clear_cover_image=remove_cover_image and new_cover is None,
        categorias=updated_categories if payload.categorias is not None else None,
        escenarios=updated_scenarios,
    )

    if invited_ids is not None:
        await event_repository.replace_invited_institutions(session, event, invited_ids)

    await session.commit()
    updated = await event_repository.get_event_by_id(session, event.id)

    if previous_planning:
        file_service.delete_media(previous_planning)
    if previous_cover:
        file_service.delete_media(previous_cover)

    return _map_event_with_stage(updated)


async def update_event_timeline(
    session: AsyncSession,
    *,
    event_id: int,
    payload: EventTimelineUpdate,
    actor: UserBase | None = None,
) -> Event:
    event = await event_repository.get_event_by_id(session, event_id)
    if not event or event.eliminado:
        raise ApplicationError("Evento no encontrado", status_code=404)

    if _is_commissioner_user(actor):
        allowed_sport = _resolve_commissioner_sport(actor)
        if int(event.deporte_id) != int(allowed_sport):
            raise ForbiddenError()

    def _days_between(start: date | None, end: date | None) -> int | None:
        if start is None or end is None:
            return None
        return (end - start).days

    registration_duration = _days_between(
        event.fecha_inscripcion_inicio, event.fecha_inscripcion_fin
    )
    audit_duration = _days_between(event.fecha_auditoria_inicio, event.fecha_auditoria_fin)
    championship_duration = _days_between(
        event.fecha_campeonato_inicio, event.fecha_campeonato_fin
    )
    gap_registration_audit = _days_between(
        event.fecha_inscripcion_fin, event.fecha_auditoria_inicio
    )
    gap_audit_championship = _days_between(
        event.fecha_auditoria_fin, event.fecha_campeonato_inicio
    )

    registration_end_updated = payload.fecha_inscripcion_fin is not None
    audit_start_updated = payload.fecha_auditoria_inicio is not None
    audit_end_updated = payload.fecha_auditoria_fin is not None
    championship_start_updated = payload.fecha_campeonato_inicio is not None
    championship_end_updated = payload.fecha_campeonato_fin is not None

    final_registration_end = (
        payload.fecha_inscripcion_fin
        if registration_end_updated
        else event.fecha_inscripcion_fin
    )
    final_registration_start = (
        payload.fecha_inscripcion_inicio
        if payload.fecha_inscripcion_inicio is not None
        else event.fecha_inscripcion_inicio
    )
    if registration_duration is not None and registration_end_updated and final_registration_end:
        final_registration_start = final_registration_end - timedelta(
            days=registration_duration
        )

    final_audit_start = (
        payload.fecha_auditoria_inicio
        if audit_start_updated
        else event.fecha_auditoria_inicio
    )
    final_audit_end = (
        payload.fecha_auditoria_fin
        if audit_end_updated
        else event.fecha_auditoria_fin
    )

    if (
        not audit_start_updated
        and not audit_end_updated
        and gap_registration_audit is not None
        and final_registration_end is not None
    ):
        final_audit_start = final_registration_end + timedelta(
            days=gap_registration_audit
        )

    if (
        not audit_start_updated
        and audit_end_updated
        and audit_duration is not None
        and final_audit_end is not None
    ):
        final_audit_start = final_audit_end - timedelta(days=audit_duration)
    elif (
        not audit_start_updated
        and gap_registration_audit is not None
        and final_registration_end is not None
    ):
        final_audit_start = final_registration_end + timedelta(
            days=gap_registration_audit
        )

    final_championship_start = (
        payload.fecha_campeonato_inicio
        if championship_start_updated
        else event.fecha_campeonato_inicio
    )
    final_championship_end = (
        payload.fecha_campeonato_fin
        if championship_end_updated
        else event.fecha_campeonato_fin
    )

    if (
        not championship_start_updated
        and gap_audit_championship is not None
        and final_audit_end is not None
    ):
        final_championship_start = final_audit_end + timedelta(
            days=gap_audit_championship
        )

    if (
        not championship_end_updated
        and championship_duration is not None
        and final_championship_start is not None
    ):
        final_championship_end = final_championship_start + timedelta(
            days=championship_duration
        )

    if registration_end_updated and not audit_start_updated:
        if gap_registration_audit is not None and final_registration_end is not None:
            final_audit_start = final_registration_end + timedelta(
                days=gap_registration_audit
            )
        elif (
            final_audit_start is not None
            and final_registration_end is not None
            and final_audit_start <= final_registration_end
        ):
            final_audit_start = final_registration_end + timedelta(days=1)

    _validate_event_schedule(
        registration_start=final_registration_start,
        registration_end=final_registration_end,
        audit_start=final_audit_start,
        audit_end=final_audit_end,
        championship_start=final_championship_start,
        championship_end=final_championship_end,
    )

    await event_repository.update_event(
        session,
        event,
        titulo=None,
        descripcion=None,
        sexo_evento=None,
        deporte_id=None,
        fecha_auditoria_inicio=final_audit_start,
        fecha_auditoria_fin=final_audit_end,
        fecha_campeonato_inicio=final_championship_start,
        fecha_campeonato_fin=final_championship_end,
        fecha_inscripcion_inicio=final_registration_start,
        fecha_inscripcion_fin=final_registration_end,
        estado=None,
        documento_planeacion=None,
        imagen_portada=None,
        clear_cover_image=False,
        categorias=None,
        escenarios=None,
    )

    await session.commit()
    refreshed = await event_repository.get_event_by_id(session, event.id)
    return _map_event_with_stage(refreshed)


async def get_event_current_stage(
    session: AsyncSession, *, event_id: int, fecha_hoy: date | None = None
) -> str:
    event = await event_repository.get_event_by_id(session, event_id)
    if not event or event.eliminado:
        raise ApplicationError("Evento no encontrado", status_code=404)
    return _calculate_event_stage(
        registration_start=event.fecha_inscripcion_inicio,
        registration_end=event.fecha_inscripcion_fin,
        audit_start=event.fecha_auditoria_inicio,
        audit_end=event.fecha_auditoria_fin,
        championship_start=event.fecha_campeonato_inicio,
        championship_end=event.fecha_campeonato_fin,
        reference_date=fecha_hoy,
        current_state=event.estado,
    )


async def list_invitations_for_institution(
    session: AsyncSession, *, institucion_id: int
) -> list[InvitationSummary]:
    invitations = await registration_repository.list_invitations_by_institution(
        session, institucion_id=institucion_id
    )
    summaries: list[InvitationSummary] = []
    for invitation in invitations:
        event = getattr(invitation, "evento", None)
        if not event or event.eliminado:
            continue
        summaries.append(map_invitation_summary(invitation))
    return summaries


async def list_invitations_for_event(
    session: AsyncSession,
    *,
    event_id: int,
    actor: UserBase | None = None,
) -> list[InvitationSummary]:
    event = await event_repository.get_event_by_id(session, event_id)
    if not event or event.eliminado:
        raise ApplicationError("Evento no encontrado", status_code=404)
    if _is_commissioner_user(actor):
        allowed_sport = _resolve_commissioner_sport(actor)
        if int(event.deporte_id) != int(allowed_sport):
            raise ForbiddenError()
    invitations = await registration_repository.list_event_invitations(
        session, event_id=event_id
    )
    return [map_invitation_summary(invitation) for invitation in invitations]


async def add_event_institution(
    session: AsyncSession,
    *,
    event_id: int,
    payload: EventInstitutionCreate,
    actor: UserBase | None = None,
) -> InvitationSummary:
    event = await event_repository.get_event_by_id(session, event_id)
    if not event or event.eliminado:
        raise ApplicationError("Evento no encontrado", status_code=404)

    if _is_commissioner_user(actor):
        allowed_sport = _resolve_commissioner_sport(actor)
        if int(event.deporte_id) != int(allowed_sport):
            raise ForbiddenError()

    institucion_id = int(payload.institucion_id)
    existing = await registration_repository.get_event_institution(
        session, event_id=event_id, institucion_id=institucion_id
    )
    if existing:
        raise ApplicationError(
            "La institución ya fue invitada a este evento", status_code=400
        )

    selectable = await institution_repository.get_selectable_institutions_by_ids(
        session, [institucion_id]
    )
    if not selectable:
        raise ApplicationError(
            "La institución seleccionada no está disponible para invitación",
            status_code=400,
        )

    invitations = await registration_repository.list_event_invitations(
        session, event_id=event_id
    )
    invited_ids = {int(inv.institucion_id) for inv in invitations}
    invited_ids.add(institucion_id)
    await event_repository.replace_invited_institutions(
        session, event, invited_ids
    )

    invitation = await registration_repository.get_event_institution(
        session, event_id=event_id, institucion_id=institucion_id
    )
    if not invitation:
        raise ApplicationError(
            "No se pudo registrar la invitación de la institución", status_code=500
        )

    try:
        await audit_service.log_event(
            session,
            entidad="evento_instituciones",
            accion="institucion_agregada",
            descripcion="Se agregó una institución invitada al evento",
            actor=actor,
            entidad_id=invitation.id,
            metadata={
                "evento_id": event_id,
                "institucion_id": institucion_id,
            },
        )
        await send_event_institution_notification(
            session,
            event_id=event_id,
            institucion_id=institucion_id,
            payload=InvitationNotificationPayload(tipo="invitacion"),
            actor=actor,
        )
    except Exception:
        await session.rollback()
        raise

    refreshed = await registration_repository.get_event_institution(
        session, event_id=event_id, institucion_id=institucion_id
    )
    return map_invitation_summary(refreshed)


async def remove_event_institution(
    session: AsyncSession,
    *,
    event_id: int,
    institucion_id: int,
    actor: UserBase | None = None,
) -> None:
    invitation = await _get_event_institution(session, event_id, institucion_id)
    event = invitation.evento

    if _is_commissioner_user(actor):
        allowed_sport = _resolve_commissioner_sport(actor)
        if int(event.deporte_id) != int(allowed_sport):
            raise ForbiddenError()

    document_paths: set[str] = set()
    for registration in getattr(invitation, "inscripciones", []) or []:
        for membership in getattr(registration, "estudiantes", []) or []:
            for document in getattr(membership, "documentos", []) or []:
                path = getattr(document, "archivo_url", None)
                if path:
                    document_paths.add(path)

    pending_documents = await registration_repository.list_pending_student_documents(
        session, invitation_id=invitation.id
    )
    for document in pending_documents:
        path = getattr(document, "archivo_url", None)
        if path:
            document_paths.add(path)

    await registration_repository.delete_pending_documents_for_invitation(
        session, invitation_id=invitation.id
    )

    for registration in list(getattr(invitation, "inscripciones", []) or []):
        await registration_repository.delete_registration(session, registration)

    await session.delete(invitation)

    await audit_service.log_event(
        session,
        entidad="evento_instituciones",
        accion="institucion_eliminada",
        descripcion="Se eliminó una institución invitada del evento",
        actor=actor,
        entidad_id=invitation.id,
        metadata={
            "evento_id": event_id,
            "institucion_id": institucion_id,
        },
    )
    await session.commit()

    for path in document_paths:
        file_service.delete_media(path)


async def send_event_institution_notification(
    session: AsyncSession,
    *,
    event_id: int,
    institucion_id: int,
    payload: InvitationNotificationPayload,
    actor: UserBase | None = None,
) -> InvitationNotificationResult:
    invitation = await _get_event_institution(session, event_id, institucion_id)
    event = invitation.evento
    if _is_commissioner_user(actor):
        allowed_sport = _resolve_commissioner_sport(actor)
        if int(event.deporte_id) != int(allowed_sport):
            raise ForbiddenError()

    notification_type = (payload.tipo or "recordatorio").strip().lower()
    if notification_type not in {"invitacion", "recordatorio"}:
        raise ApplicationError("Tipo de notificación inválido", status_code=400)

    institution = invitation.institucion
    recipients = _collect_institution_recipients(institution)
    representative_users = []
    seen_user_ids: set[int] = set()
    for representative in getattr(institution, "representantes", []) or []:
        if getattr(representative, "id", None) is None:
            continue
        if not getattr(representative, "email", None):
            continue
        if getattr(representative, "eliminado", False):
            continue
        if getattr(representative, "activo", True) is False:
            continue
        role_names = {
            (getattr(role, "nombre", "") or "").strip().lower()
            for role in getattr(representative, "roles", []) or []
        }
        if "representante educativo" not in role_names:
            continue
        if representative.id in seen_user_ids:
            continue
        seen_user_ids.add(int(representative.id))
        representative_users.append(representative)
    if not recipients:
        raise ApplicationError(
            "La institución no tiene contactos habilitados para notificaciones",
            status_code=400,
        )

    stage = _calculate_event_stage(
        registration_start=event.fecha_inscripcion_inicio,
        registration_end=event.fecha_inscripcion_fin,
        audit_start=event.fecha_auditoria_inicio,
        audit_end=event.fecha_auditoria_fin,
        championship_start=event.fecha_campeonato_inicio,
        championship_end=event.fecha_campeonato_fin,
        current_state=event.estado,
    )

    registration_start = event.fecha_inscripcion_inicio
    registration_end = event.fecha_inscripcion_fin

    portal_base = settings.frontend_base_url.rstrip("/")
    manager_path = "/admin/eventos/inscripcion"
    portal_url = f"{portal_base}{manager_path}?evento={event.id}"

    sent = 0
    seen_emails: set[str] = set()
    institution_name = getattr(institution, "nombre", None)
    for recipient_name, email in recipients:
        normalized_email = (email or "").strip().lower()
        if not normalized_email or normalized_email in seen_emails:
            continue
        seen_emails.add(normalized_email)
        sent += 1
        email_service.enqueue_event_invitation_notification(
            to=email,
            institution_name=recipient_name or institution_name,
            event_title=event.titulo,
            notification_type=notification_type,
            registration_start=registration_start,
            registration_end=registration_end,
            portal_url=portal_url,
        )

    notification_title = (
        f"Invitación al evento {event.titulo}"
        if notification_type == "invitacion"
        else f"Recordatorio de inscripción: {event.titulo}"
    )
    notification_message = (
        "Has recibido una nueva invitación para registrar a tu institución en este evento."
        if notification_type == "invitacion"
        else "Recuerda completar o actualizar la inscripción de tu institución antes del cierre."
    )
    notification_level = "info" if notification_type == "invitacion" else "warning"
    metadata_common = {
        "evento_id": event.id,
        "institucion_id": institucion_id,
        "tipo": notification_type,
        "etapa": stage,
        "portal_url": portal_url,
    }
    if registration_start:
        metadata_common["fecha_inscripcion_inicio"] = registration_start.isoformat()
    if registration_end:
        metadata_common["fecha_inscripcion_fin"] = registration_end.isoformat()

    for representative in representative_users:
        metadata_payload = dict(metadata_common)
        metadata_payload["destinatario_email"] = getattr(representative, "email", None)
        await notification_repository.create_notification(
            session,
            usuario_id=int(representative.id),
            titulo=notification_title,
            mensaje=notification_message,
            tipo="evento",
            nivel=notification_level,
            metadata=metadata_payload,
            evento_id=event.id,
        )

    await audit_service.log_event(
        session,
        entidad="evento_instituciones",
        accion="notificacion_enviada",
        descripcion="Se envió una notificación a la institución",
        actor=actor,
        entidad_id=invitation.id,
        metadata={
            "evento_id": event_id,
            "institucion_id": institucion_id,
            "etapa": stage,
            "tipo": notification_type,
            "destinatarios": sent,
        },
    )
    await session.commit()
    return InvitationNotificationResult(enviados=sent)


async def accept_event_invitation(
    session: AsyncSession,
    *,
    event_id: int,
    institucion_id: int,
    actor: UserBase | None = None,
) -> InvitationSummary:
    invitation = await _get_event_institution(session, event_id, institucion_id)
    event = invitation.evento

    stage = _calculate_event_stage(
        registration_start=event.fecha_inscripcion_inicio,
        registration_end=event.fecha_inscripcion_fin,
        audit_start=event.fecha_auditoria_inicio,
        audit_end=event.fecha_auditoria_fin,
        championship_start=event.fecha_campeonato_inicio,
        championship_end=event.fecha_campeonato_fin,
        current_state=event.estado,
    )
    if stage != "inscripcion":
        raise ApplicationError(
            "El evento no se encuentra en etapa de inscripción", status_code=403
        )

    if invitation.estado_invitacion == "rechazada":
        raise ApplicationError(
            "La invitación ya fue rechazada por la institución", status_code=400
        )

    invitation.estado_invitacion = "aceptada"
    invitation.estado_auditoria = "pendiente"
    invitation.motivo_rechazo = None
    await audit_service.log_event(
        session,
        entidad="evento_instituciones",
        accion="invitacion_aceptada",
        descripcion="La institución aceptó la invitación",
        actor=actor,
        entidad_id=invitation.id,
        metadata={"evento_id": event_id, "institucion_id": institucion_id},
    )
    await session.commit()
    return map_invitation_summary(invitation)


async def reject_event_invitation(
    session: AsyncSession,
    *,
    event_id: int,
    institucion_id: int,
    actor: UserBase | None = None,
) -> InvitationSummary:
    invitation = await _get_event_institution(session, event_id, institucion_id)

    if invitation.estado_invitacion == "aceptada":
        raise ApplicationError(
            "La invitación ya fue aceptada por la institución", status_code=400
        )

    if invitation.estado_invitacion == "rechazada":
        return map_invitation_summary(invitation)

    for registration in list(getattr(invitation, "inscripciones", []) or []):
        await registration_repository.delete_registration(session, registration)

    invitation.estado_invitacion = "rechazada"
    invitation.estado_auditoria = "pendiente"
    invitation.motivo_rechazo = "Rechazada por la institución"
    invitation.habilitado_campeonato = False
    invitation.ultima_version_enviada_en = None

    await audit_service.log_event(
        session,
        entidad="evento_instituciones",
        accion="invitacion_rechazada",
        descripcion="La institución rechazó la invitación",
        actor=actor,
        entidad_id=invitation.id,
        metadata={"evento_id": event_id, "institucion_id": institucion_id},
    )
    await session.commit()
    return map_invitation_summary(invitation)


async def get_institution_registration(
    session: AsyncSession,
    *,
    event_id: int,
    institucion_id: int,
) -> RegistrationSnapshot:
    invitation = await _get_event_institution(session, event_id, institucion_id)
    return map_registration_snapshot(invitation)


async def save_institution_registration(
    session: AsyncSession,
    *,
    event_id: int,
    institucion_id: int,
    payload: RegistrationPayload,
    actor: UserBase | None = None,
) -> RegistrationSnapshot:
    invitation = await _get_event_institution(session, event_id, institucion_id)
    event = invitation.evento
    stage = _calculate_event_stage(
        registration_start=event.fecha_inscripcion_inicio,
        registration_end=event.fecha_inscripcion_fin,
        audit_start=event.fecha_auditoria_inicio,
        audit_end=event.fecha_auditoria_fin,
        championship_start=event.fecha_campeonato_inicio,
        championship_end=event.fecha_campeonato_fin,
        current_state=event.estado,
    )
    can_edit = _can_edit_institution_registration(invitation, event, stage)

    if not can_edit:
        raise ApplicationError(
            "Las inscripciones ya no están disponibles para este evento",
            status_code=403,
        )

    if invitation.estado_invitacion not in {"aceptada", "pendiente"}:
        raise ApplicationError(
            "La institución no está habilitada para registrar estudiantes", status_code=403
        )

    if invitation.estado_invitacion == "pendiente":
        invitation.estado_invitacion = "aceptada"

    requested_student_ids = set(int(item) for item in payload.estudiantes)
    students = await student_repository.get_students_by_ids(
        session, requested_student_ids
    )
    students_by_id = {student.id: student for student in students}

    event_categories = list(getattr(event, "categorias", []) or [])
    has_unbounded_category = any(
        getattr(category, "edad_minima", None) is None
        and getattr(category, "edad_maxima", None) is None
        for category in event_categories
    )
    category_bounds: list[tuple[int | None, int | None, str | None]] = [
        (
            getattr(category, "edad_minima", None),
            getattr(category, "edad_maxima", None),
            getattr(category, "nombre", None),
        )
        for category in event_categories
        if getattr(category, "edad_minima", None) is not None
        or getattr(category, "edad_maxima", None) is not None
    ]

    enforce_age_filter = bool(category_bounds) and not has_unbounded_category

    reference_date = (
        getattr(event, "fecha_campeonato_inicio", None)
        or getattr(event, "fecha_auditoria_inicio", None)
        or getattr(event, "fecha_inscripcion_fin", None)
        or getattr(event, "fecha_inscripcion_inicio", None)
        or date.today()
    )

    def _calculate_age(birth_date: date | None) -> int | None:
        if not birth_date:
            return None
        years = reference_date.year - birth_date.year
        if (reference_date.month, reference_date.day) < (
            birth_date.month,
            birth_date.day,
        ):
            years -= 1
        return years

    now = datetime.now(timezone.utc)
    valid_students: set[int] = set()

    for student_id in requested_student_ids:
        student = students_by_id.get(student_id)
        if not student:
            raise ApplicationError(
                "Uno de los estudiantes seleccionados no existe", status_code=404
            )
        if student.institucion_id != institucion_id:
            raise ApplicationError(
                "Solo puedes inscribir estudiantes de tu institución",
                status_code=403,
            )
        if event.sexo_evento != "MX":
            student_gender = (student.genero or "").upper()
            if student_gender != event.sexo_evento.upper():
                raise ApplicationError(
                    "El sexo del estudiante no coincide con el del evento",
                    status_code=400,
                )
        if enforce_age_filter:
            student_age = _calculate_age(getattr(student, "fecha_nacimiento", None))
            if student_age is None:
                raise ApplicationError(
                    "El estudiante no tiene registrada una fecha de nacimiento válida",
                    status_code=400,
                )
            matches_category = any(
                (min_age is None or student_age >= min_age)
                and (max_age is None or student_age <= max_age)
                for min_age, max_age, _ in category_bounds
            )
            if not matches_category:
                full_name = f"{getattr(student, 'nombres', '')} {getattr(student, 'apellidos', '')}".strip()
                raise ApplicationError(
                    (
                        "El estudiante"
                        f" {full_name or student.documento_identidad or student.id} "
                        "no cumple con el rango de edad permitido para las categorías del evento"
                    ).strip(),
                    status_code=400,
                )
        valid_students.add(student_id)

    existing_registrations = list(getattr(invitation, "inscripciones", []) or [])
    registration = existing_registrations[0] if existing_registrations else None

    institution = invitation.institucion
    default_team_name = getattr(institution, "nombre", "Participantes")

    if registration is None:
        registration = await registration_repository.create_registration(
            session,
            evento=event,
            evento_institucion=invitation,
            categoria_id=None,
            nombre_equipo=default_team_name,
        )
    else:
        # Eliminar inscripciones adicionales heredadas
        for leftover in existing_registrations[1:]:
            await registration_repository.delete_registration(session, leftover)

    await registration_repository.update_registration(
        session,
        registration,
        categoria_id=None,
        nombre_equipo=default_team_name,
        bloqueado=False,
        aprobado=False,
    )

    await registration_repository.replace_registration_students(
        session, registration, valid_students
    )
    registration.ultima_version_enviada_en = now

    pending_attached, replaced_paths = await _apply_pending_student_documents(
        session,
        invitation,
        student_ids=valid_students,
    )

    total_students = len(valid_students)

    invitation.ultima_version_enviada_en = now
    invitation.estado_auditoria = "pendiente"
    invitation.motivo_rechazo = None
    invitation.habilitado_campeonato = False

    metadata = {
        "evento_id": event_id,
        "institucion_id": institucion_id,
        "participantes": total_students,
    }
    if pending_attached:
        metadata["documentos_pendientes_asociados"] = pending_attached

    await audit_service.log_event(
        session,
        entidad="evento_inscripciones",
        accion="registro_actualizado",
        descripcion="La institución actualizó su registro de participantes",
        actor=actor,
        entidad_id=invitation.id,
        metadata=metadata,
    )
    await _notify_commissioners_registration_activity(
        session,
        event=event,
        institution=institution,
        actor=actor,
        action_date=now,
        change_type="inscripcion_actualizada",
        message_suffix="actualizó la inscripción",
        metadata_extra={
            "participantes": total_students,
            "documentos_pendientes_asociados": pending_attached,
        },
    )
    await session.commit()
    refreshed = await registration_repository.get_event_institution(
        session, event_id=event_id, institucion_id=institucion_id
    )

    for path in set(replaced_paths):
        file_service.delete_media(path)
    return map_registration_snapshot(refreshed)


async def upload_student_document(
    session: AsyncSession,
    *,
    event_id: int,
    institucion_id: int,
    estudiante_id: int,
    tipo_documento: str,
    archivo: UploadFile,
    actor: UserBase | None = None,
) -> RegistrationStudentDocument:
    if not archivo:
        raise ApplicationError("Debes adjuntar un archivo", status_code=400)

    if not _is_pdf_upload(archivo):
        raise ApplicationError(
            "Formato de archivo inválido, solo se aceptan archivos PDF",
            status_code=400,
        )

    invitation = await _get_event_institution(session, event_id, institucion_id)
    event = invitation.evento
    stage = _calculate_event_stage(
        registration_start=event.fecha_inscripcion_inicio,
        registration_end=event.fecha_inscripcion_fin,
        audit_start=event.fecha_auditoria_inicio,
        audit_end=event.fecha_auditoria_fin,
        championship_start=event.fecha_campeonato_inicio,
        championship_end=event.fecha_campeonato_fin,
        current_state=event.estado,
    )
    if not _can_edit_institution_registration(invitation, event, stage):
        raise ApplicationError(
            "Este evento no permite cargar documentos en la etapa actual",
            status_code=403,
        )

    membership = await registration_repository.get_student_membership(
        session,
        event_id=event_id,
        institucion_id=institucion_id,
        estudiante_id=estudiante_id,
    )

    normalized_type = _normalize_student_document_type(tipo_documento)
    previous_path = None
    if membership:
        for document in getattr(membership, "documentos", []) or []:
            if (document.tipo_documento or "").strip().lower() == normalized_type:
                previous_path = document.archivo_url
                break
    else:
        pending_document = await registration_repository.get_pending_student_document(
            session,
            invitation_id=invitation.id,
            estudiante_id=estudiante_id,
            tipo_documento=normalized_type,
        )
        if pending_document:
            previous_path = pending_document.archivo_url

    new_path = None
    try:
        new_path = await file_service.save_document(
            archivo, folder="events/student-documents"
        )
        if membership:
            document = await registration_repository.upsert_student_document(
                session,
                membership,
                tipo_documento=normalized_type,
                archivo_url=new_path,
            )
        else:
            document = await registration_repository.upsert_pending_student_document(
                session,
                invitation,
                estudiante_id=estudiante_id,
                tipo_documento=normalized_type,
                archivo_url=new_path,
            )
        action_time = datetime.now(timezone.utc)
        await audit_service.log_event(
            session,
            entidad="evento_inscripcion_documentos",
            accion="actualizado",
            descripcion="Se cargó documentación del estudiante",
            actor=actor,
            entidad_id=getattr(membership, "id", invitation.id),
            metadata={
                "evento_id": event_id,
                "institucion_id": institucion_id,
                "estudiante_id": estudiante_id,
                "tipo_documento": normalized_type,
                "pendiente_inscripcion": membership is None,
            },
        )
        await _notify_commissioners_registration_activity(
            session,
            event=event,
            institution=invitation.institucion,
            actor=actor,
            action_date=action_time,
            change_type="documento_actualizado",
            message_suffix=f"cargó el documento {_get_document_label(normalized_type)}",
            metadata_extra={
                "estudiante_id": estudiante_id,
                "tipo_documento": normalized_type,
                "pendiente_inscripcion": membership is None,
            },
        )
        await session.commit()
        if membership:
            await session.refresh(document)
    except Exception:
        file_service.delete_media(new_path)
        raise

    if previous_path and previous_path != getattr(document, "archivo_url", new_path):
        file_service.delete_media(previous_path)

    if membership:
        return RegistrationStudentDocument.model_validate(document)

    return RegistrationStudentDocument(
        id=document.id,
        tipo_documento=document.tipo_documento,
        archivo_url=document.archivo_url,
        subido_en=document.subido_en,
        estado_revision=None,
        observaciones_revision=None,
        revisado_en=None,
        revisado_por_id=None,
        revisado_por_nombre=None,
    )


async def upload_student_documents_batch(
    session: AsyncSession,
    *,
    event_id: int,
    institucion_id: int,
    payload: StudentDocumentBatchUpload,
    archivos: Sequence[UploadFile],
    actor: UserBase | None = None,
) -> StudentDocumentBatchResult:
    if not payload.documentos:
        raise ApplicationError(
            "Debes adjuntar al menos un documento para cargar", status_code=400
        )

    if len(payload.documentos) != len(archivos):
        raise ApplicationError(
            "La cantidad de archivos no coincide con los documentos enviados",
            status_code=400,
        )

    invitation = await _get_event_institution(session, event_id, institucion_id)
    event = invitation.evento
    stage = _calculate_event_stage(
        registration_start=event.fecha_inscripcion_inicio,
        registration_end=event.fecha_inscripcion_fin,
        audit_start=event.fecha_auditoria_inicio,
        audit_end=event.fecha_auditoria_fin,
        championship_start=event.fecha_campeonato_inicio,
        championship_end=event.fecha_campeonato_fin,
        current_state=event.estado,
    )
    if not _can_edit_institution_registration(invitation, event, stage):
        raise ApplicationError(
            "Este evento no permite cargar documentos en la etapa actual",
            status_code=403,
        )

    results: list[StudentDocumentUploadStatus] = []
    successes = 0
    failures = 0

    for index, document_payload in enumerate(payload.documentos):
        file = archivos[index] if index < len(archivos) else None
        if not file:
            failures += 1
            results.append(
                StudentDocumentUploadStatus(
                    estudiante_id=document_payload.estudiante_id,
                    tipo_documento=document_payload.tipo_documento,
                    exito=False,
                    mensaje="No se adjuntó un archivo para este documento",
                    nombre_archivo=None,
                )
            )
            continue

        try:
            if not _is_pdf_upload(file):
                raise ApplicationError(
                    "Formato de archivo inválido, solo se aceptan archivos PDF",
                    status_code=400,
                )

            document = await upload_student_document(
                session,
                event_id=event_id,
                institucion_id=institucion_id,
                estudiante_id=document_payload.estudiante_id,
                tipo_documento=document_payload.tipo_documento,
                archivo=file,
                actor=actor,
            )
        except ApplicationError as error:
            await session.rollback()
            failures += 1
            results.append(
                StudentDocumentUploadStatus(
                    estudiante_id=document_payload.estudiante_id,
                    tipo_documento=document_payload.tipo_documento,
                    exito=False,
                    mensaje=str(error.detail),
                    nombre_archivo=getattr(file, "filename", None),
                )
            )
            continue
        except Exception:
            await session.rollback()
            failures += 1
            results.append(
                StudentDocumentUploadStatus(
                    estudiante_id=document_payload.estudiante_id,
                    tipo_documento=document_payload.tipo_documento,
                    exito=False,
                    mensaje=(
                        "Ocurrió un error inesperado al cargar el documento. "
                        "Inténtalo nuevamente más tarde."
                    ),
                    nombre_archivo=getattr(file, "filename", None),
                )
            )
            continue

        successes += 1
        results.append(
            StudentDocumentUploadStatus(
                estudiante_id=document_payload.estudiante_id,
                tipo_documento=document.tipo_documento,
                exito=True,
                mensaje="Documento cargado correctamente",
                nombre_archivo=getattr(file, "filename", None),
            )
        )

    summary = StudentDocumentBatchSummary(exitosos=successes, fallidos=failures)
    return StudentDocumentBatchResult(resumen=summary, resultados=results)


async def review_institution_documents(
    session: AsyncSession,
    *,
    event_id: int,
    institucion_id: int,
    payload: StudentDocumentReviewPayload,
    actor: UserBase,
) -> RegistrationSnapshot:
    invitation = await _get_event_institution(session, event_id, institucion_id)
    event = invitation.evento

    if _is_commissioner_user(actor):
        allowed_sport = _resolve_commissioner_sport(actor)
        if int(event.deporte_id) != int(allowed_sport):
            raise ForbiddenError()

    documents_by_id: dict[int, object] = {}
    for registration in getattr(invitation, "inscripciones", []) or []:
        for membership in getattr(registration, "estudiantes", []) or []:
            for document in getattr(membership, "documentos", []) or []:
                doc_id = getattr(document, "id", None)
                if doc_id is not None:
                    documents_by_id[int(doc_id)] = document

    review_items = payload.documentos or []
    if not review_items:
        return map_registration_snapshot(invitation)

    processed: set[int] = set()
    updated = 0
    states_summary: dict[str, int] = {}

    for item in review_items:
        document_id = int(item.documento_id)
        if document_id in processed:
            continue
        processed.add(document_id)
        document = documents_by_id.get(document_id)
        if not document:
            raise ApplicationError(
                "Uno de los documentos seleccionados no pertenece a la institución",
                status_code=404,
            )
        normalized_state = _normalize_document_review_state(item.estado)
        note = (item.observaciones or "").strip() or None
        await registration_repository.update_student_document_review(
            session,
            document,
            estado_revision=normalized_state,
            observaciones_revision=note,
            revisado_por_id=getattr(actor, "id", None),
        )
        updated += 1
        states_summary[normalized_state] = states_summary.get(normalized_state, 0) + 1

    action_time = datetime.now(timezone.utc)
    await audit_service.log_event(
        session,
        entidad="evento_inscripcion_documentos",
        accion="revision_actualizada",
        descripcion="Se registró la revisión de la documentación estudiantil",
        actor=actor,
        entidad_id=invitation.id,
        metadata={
            "evento_id": event_id,
            "institucion_id": institucion_id,
            "documentos_actualizados": updated,
            "resumen_estados": states_summary,
        },
    )
    if _is_admin_user(actor) or _is_commissioner_user(actor):
        level = "warning" if states_summary.get("correccion", 0) else "info"
        await _notify_institution_audit_activity(
            session,
            event=event,
            institution=invitation.institucion,
            actor=actor,
            action_date=action_time,
            change_type="documentos_revisados",
            message=(
                f"Se actualizó la revisión de {updated} documento(s) para "
                f"{getattr(invitation.institucion, 'nombre', 'la institución')}"
            ),
            metadata_extra={
                "documentos_actualizados": updated,
                "resumen_estados": states_summary,
            },
            level=level,
        )
    await session.commit()
    refreshed = await registration_repository.get_event_institution(
        session, event_id=event_id, institucion_id=institucion_id
    )
    return map_registration_snapshot(refreshed)


async def extend_institution_registration(
    session: AsyncSession,
    *,
    event_id: int,
    institucion_id: int,
    payload: RegistrationExtensionPayload,
    actor: UserBase | None = None,
) -> RegistrationSnapshot:
    invitation = await _get_event_institution(session, event_id, institucion_id)
    event = invitation.evento
    if _is_commissioner_user(actor):
        allowed_sport = _resolve_commissioner_sport(actor)
        if int(event.deporte_id) != int(allowed_sport):
            raise ForbiddenError()

    new_deadline = payload.fecha_inscripcion_extendida
    audit_end = getattr(event, "fecha_auditoria_fin", None)
    registration_end = getattr(event, "fecha_inscripcion_fin", None)
    if new_deadline is not None:
        if audit_end and new_deadline > audit_end:
            raise ApplicationError(
                "La prórroga no puede ser posterior al fin de auditoría", status_code=400
            )
        if registration_end and new_deadline < registration_end:
            raise ApplicationError(
                "La prórroga debe ser igual o posterior al cierre general de inscripción",
                status_code=400,
            )

    invitation.fecha_inscripcion_extendida = new_deadline

    await audit_service.log_event(
        session,
        entidad="evento_instituciones",
        accion="inscripcion_prorrogada",
        descripcion="Se actualizó la prórroga de inscripción para la institución",
        actor=actor,
        entidad_id=invitation.id,
        metadata={
            "evento_id": event_id,
            "institucion_id": institucion_id,
            "fecha_inscripcion_extendida": new_deadline,
        },
    )
    await session.commit()
    refreshed = await registration_repository.get_event_institution(
        session, event_id=event_id, institucion_id=institucion_id
    )
    return map_registration_snapshot(refreshed)


async def audit_institution_registration(
    session: AsyncSession,
    *,
    event_id: int,
    institucion_id: int,
    payload: AuditDecisionPayload,
    actor: UserBase,
) -> InvitationSummary:
    invitation = await _get_event_institution(session, event_id, institucion_id)
    event = invitation.evento
    if _is_commissioner_user(actor):
        allowed_sport = _resolve_commissioner_sport(actor)
        if int(event.deporte_id) != int(allowed_sport):
            raise ForbiddenError()
    stage = _calculate_event_stage(
        registration_start=event.fecha_inscripcion_inicio,
        registration_end=event.fecha_inscripcion_fin,
        audit_start=event.fecha_auditoria_inicio,
        audit_end=event.fecha_auditoria_fin,
        championship_start=event.fecha_campeonato_inicio,
        championship_end=event.fecha_campeonato_fin,
        current_state=event.estado,
    )
    decision = payload.decision
    motivo = (payload.motivo or "").strip() or None

    today = date.today()
    registration_deadline = event.fecha_inscripcion_fin
    can_decide_during_registration = (
        stage == "inscripcion"
        and registration_deadline is not None
        and today >= registration_deadline - timedelta(days=1)
    )
    can_take_final_decision = stage == "auditoria" or can_decide_during_registration

    if decision == "aprobar":
        if not can_take_final_decision:
            raise ApplicationError(
                "Solo puedes aprobar durante la etapa de auditoría o al cierre de la inscripción",
                status_code=403,
            )
        for registration in invitation.inscripciones:
            for membership in getattr(registration, "estudiantes", []) or []:
                documents = {
                    (getattr(document, "tipo_documento", "") or "").strip().lower(): document
                    for document in getattr(membership, "documentos", []) or []
                }
                missing_labels = [
                    label
                    for key, label in _REQUIRED_STUDENT_DOCUMENTS.items()
                    if key not in documents or not getattr(documents[key], "archivo_url", None)
                ]
                if missing_labels:
                    student = getattr(membership, "estudiante", None)
                    student_name = (
                        f"{getattr(student, 'nombres', '')} {getattr(student, 'apellidos', '')}"
                        .strip()
                        or f"ID {getattr(student, 'id', membership.estudiante_id)}"
                    )
                    raise ApplicationError(
                        "No puedes aprobar porque hay documentación pendiente para "
                        f"{student_name}: {', '.join(missing_labels)}",
                        status_code=400,
                    )
        invitation.estado_auditoria = "aprobada"
        invitation.motivo_rechazo = None
        invitation.habilitado_campeonato = True
        for registration in invitation.inscripciones:
            await registration_repository.update_registration(
                session, registration, aprobado=True, bloqueado=True
            )
    elif decision == "rechazar":
        if not can_take_final_decision:
            raise ApplicationError(
                "Solo puedes rechazar durante la etapa de auditoría o al cierre de la inscripción",
                status_code=403,
            )
        invitation.estado_auditoria = "rechazada"
        invitation.motivo_rechazo = motivo
        invitation.habilitado_campeonato = False
        for registration in invitation.inscripciones:
            await registration_repository.update_registration(
                session, registration, aprobado=False, bloqueado=True
            )
    elif decision == "corregir":
        if event.fecha_inscripcion_fin and date.today() > event.fecha_inscripcion_fin:
            raise ApplicationError(
                "Ya no es posible solicitar correcciones", status_code=403
            )
        invitation.estado_auditoria = "correccion"
        invitation.motivo_rechazo = motivo
        invitation.habilitado_campeonato = False
        for registration in invitation.inscripciones:
            await registration_repository.update_registration(
                session, registration, aprobado=False, bloqueado=False
            )
    else:
        raise ApplicationError("Decisión de auditoría inválida", status_code=400)

    await registration_repository.create_audit_record(
        session,
        evento=event,
        evento_institucion=invitation,
        accion=decision,
        motivo=motivo,
        actor_id=actor.id,
    )
    action_time = datetime.now(timezone.utc)
    await audit_service.log_event(
        session,
        entidad="evento_instituciones",
        accion="auditoria_actualizada",
        descripcion=f"Se registró la decisión de auditoría: {decision}",
        actor=actor,
        entidad_id=invitation.id,
        metadata={
            "evento_id": event_id,
            "institucion_id": institucion_id,
            "decision": decision,
        },
    )
    decision_labels = {
        "aprobar": "Aprobada",
        "rechazar": "Rechazada",
        "corregir": "Corrección solicitada",
    }
    if _is_admin_user(actor) or _is_commissioner_user(actor):
        actor_name = _resolve_actor_name(actor)
        message = (
            f"{actor_name} registró la decisión de auditoría: {decision_labels.get(decision, decision)}."
        )
        level = "warning" if decision in {"rechazar", "corregir"} else "info"
        metadata_extra = {"decision": decision}
        if motivo:
            metadata_extra["motivo"] = motivo
        await _notify_institution_audit_activity(
            session,
            event=event,
            institution=invitation.institucion,
            actor=actor,
            action_date=action_time,
            change_type="decision_auditoria",
            message=message,
            metadata_extra=metadata_extra,
            level=level,
        )
    await session.commit()
    refreshed = await registration_repository.get_event_institution(
        session, event_id=event_id, institucion_id=institucion_id
    )
    return map_invitation_summary(refreshed)


async def audit_institutions_registration_batch(
    session: AsyncSession,
    *,
    event_id: int,
    payload: AuditDecisionBatchPayload,
    actor: UserBase,
) -> list[InvitationSummary]:
    event = await event_repository.get_event_by_id(session, event_id)
    if not event or event.eliminado:
        raise ApplicationError("Evento no encontrado", status_code=404)
    if _is_commissioner_user(actor):
        allowed_sport = _resolve_commissioner_sport(actor)
        if int(event.deporte_id) != int(allowed_sport):
            raise ForbiddenError()

    stage = _calculate_event_stage(
        registration_start=event.fecha_inscripcion_inicio,
        registration_end=event.fecha_inscripcion_fin,
        audit_start=event.fecha_auditoria_inicio,
        audit_end=event.fecha_auditoria_fin,
        championship_start=event.fecha_campeonato_inicio,
        championship_end=event.fecha_campeonato_fin,
        current_state=event.estado,
    )
    if stage != "auditoria":
        raise ApplicationError(
            "Solo puedes registrar decisiones grupales durante la etapa de auditoría",
            status_code=403,
        )

    decision_payload = AuditDecisionPayload(
        decision=payload.decision, motivo=payload.motivo
    )
    summaries: list[InvitationSummary] = []
    for institution_id in payload.instituciones:
        summary = await audit_institution_registration(
            session,
            event_id=event_id,
            institucion_id=institution_id,
            payload=decision_payload,
            actor=actor,
        )
        summaries.append(summary)
    return summaries


async def list_event_fixture(
    session: AsyncSession,
    *,
    event_id: int,
    actor: UserBase | None = None,
) -> list[FixtureMatch]:
    event = await event_repository.get_event_by_id(session, event_id)
    if not event or event.eliminado:
        raise ApplicationError("Evento no encontrado", status_code=404)
    if _is_commissioner_user(actor):
        allowed_sport = _resolve_commissioner_sport(actor)
        if int(event.deporte_id) != int(allowed_sport):
            raise ForbiddenError()
    matches = await registration_repository.list_fixture(session, event_id=event_id)
    return [map_fixture_match(match) for match in matches]


async def update_event_fixture(
    session: AsyncSession,
    *,
    event_id: int,
    payload: FixturePayload,
    actor: UserBase | None = None,
) -> list[FixtureMatch]:
    event = await event_repository.get_event_by_id(session, event_id)
    if not event or event.eliminado:
        raise ApplicationError("Evento no encontrado", status_code=404)
    if _is_commissioner_user(actor):
        allowed_sport = _resolve_commissioner_sport(actor)
        if int(event.deporte_id) != int(allowed_sport):
            raise ForbiddenError()
    stage = _calculate_event_stage(
        registration_start=event.fecha_inscripcion_inicio,
        registration_end=event.fecha_inscripcion_fin,
        audit_start=event.fecha_auditoria_inicio,
        audit_end=event.fecha_auditoria_fin,
        championship_start=event.fecha_campeonato_inicio,
        championship_end=event.fecha_campeonato_fin,
    )
    if stage != "campeonato":
        raise ApplicationError(
            "Solo se puede gestionar el calendario en etapa de campeonato",
            status_code=403,
        )

    approved_teams = {
        registration.id: registration
        for registration in collect_eligible_registrations(event)
    }
    allowed_categories = {categoria.id for categoria in event.categorias}
    allowed_scenarios = {
        escenario.id for escenario in event.escenarios if escenario.id is not None
    }

    partidos_payload: list[dict] = []
    for match in payload.partidos:
        if match.categoria_id and match.categoria_id not in allowed_categories:
            raise ApplicationError(
                "La categoría seleccionada no pertenece al evento", status_code=400
            )
        if match.equipo_local_id and match.equipo_local_id not in approved_teams:
            raise ApplicationError(
                "El equipo local no está aprobado para el campeonato",
                status_code=400,
            )
        if match.equipo_visitante_id and match.equipo_visitante_id not in approved_teams:
            raise ApplicationError(
                "El equipo visitante no está aprobado para el campeonato",
                status_code=400,
            )
        if match.equipo_local_id and match.equipo_local_id == match.equipo_visitante_id:
            raise ApplicationError(
                "Un partido no puede enfrentar al mismo equipo", status_code=400
            )
        if match.escenario_evento_id and (
            match.escenario_evento_id not in allowed_scenarios
        ):
            raise ApplicationError(
                "El escenario seleccionado no pertenece al evento", status_code=400
            )
        partidos_payload.append(
            {
                "fecha": match.fecha,
                "hora": match.hora,
                "escenario_evento_id": match.escenario_evento_id,
                "categoria_id": match.categoria_id,
                "equipo_local_id": match.equipo_local_id,
                "equipo_visitante_id": match.equipo_visitante_id,
                "ronda": match.ronda,
                "llave": match.llave,
                "observaciones": match.observaciones,
            }
        )

    await registration_repository.replace_fixture(
        session, evento=event, partidos=partidos_payload
    )
    await audit_service.log_event(
        session,
        entidad="eventos_partidos",
        accion="actualizado",
        descripcion="Se actualizó el calendario del evento",
        actor=actor,
        entidad_id=event.id,
        metadata={"partidos": len(partidos_payload)},
    )
    await session.commit()
    matches = await registration_repository.list_fixture(session, event_id=event_id)
    return [map_fixture_match(match) for match in matches]


def _build_match_news_payload(
    event: Evento, match: EventoPartido
) -> tuple[NewsCreate, dict[str, str | int]]:
    deporte = getattr(event, "deporte", None)
    local_name = getattr(match.equipo_local, "nombre_equipo", None) or "Equipo local"
    visitor_name = getattr(match.equipo_visitante, "nombre_equipo", None) or "Equipo visitante"
    category = getattr(deporte, "nombre", None) or "Campeonatos"
    title = f"{local_name} {match.puntaje_local} - {match.puntaje_visitante} {visitor_name}"
    summary = (
        f"{event.titulo}: {local_name} y {visitor_name} definieron su encuentro "
        f"con marcador {match.puntaje_local}-{match.puntaje_visitante}."
    )
    content = (
        f"Resultado registrado en el evento {event.titulo}. "
        f"{local_name} {match.puntaje_local} - {match.puntaje_visitante} {visitor_name}."
    )
    payload = NewsCreate(
        titulo=title,
        resumen=summary,
        contenido=content,
        categoria=category,
        etiquetas=[event.titulo, category, "campeonato"],
        estado="publicado",
        fecha_publicacion=datetime.now(timezone.utc),
        slug=None,
        destacado=False,
    )
    return payload, {"title": title}


async def _publish_match_news(
    session: AsyncSession,
    *,
    event: Evento,
    match: EventoPartido,
    actor: UserBase | None = None,
) -> dict | None:
    if match.noticia_publicada:
        return None
    if match.puntaje_local is None or match.puntaje_visitante is None:
        raise ApplicationError(
            "Debes registrar el resultado del partido antes de publicar", status_code=400
        )
    news_payload, context = _build_match_news_payload(event, match)
    noticia = await create_news(
        session,
        autor_id=getattr(actor, "id", None),
        payload=news_payload,
    )
    match.noticia_publicada = True
    await audit_service.log_event(
        session,
        entidad="eventos_partidos",
        accion="noticia_publicada",
        descripcion="Se publicó la noticia de un partido",
        actor=actor,
        entidad_id=match.id,
        metadata={"news_id": noticia.id, "title": context.get("title")},
    )
    return {"news_id": noticia.id, "news_slug": noticia.slug}


async def register_match_result(
    session: AsyncSession,
    *,
    event_id: int,
    match_id: int,
    payload: MatchResultPayload,
    actor: UserBase | None = None,
) -> tuple[FixtureMatch, dict | None]:
    event = await event_repository.get_event_by_id(session, event_id)
    if not event or event.eliminado:
        raise ApplicationError("Evento no encontrado", status_code=404)
    if _is_commissioner_user(actor):
        allowed_sport = _resolve_commissioner_sport(actor)
        if int(event.deporte_id) != int(allowed_sport):
            raise ForbiddenError()
    stage = _calculate_event_stage(
        registration_start=event.fecha_inscripcion_inicio,
        registration_end=event.fecha_inscripcion_fin,
        audit_start=event.fecha_auditoria_inicio,
        audit_end=event.fecha_auditoria_fin,
        championship_start=event.fecha_campeonato_inicio,
        championship_end=event.fecha_campeonato_fin,
    )
    if stage not in {"campeonato", "finalizado"}:
        raise ApplicationError(
            "Solo se pueden registrar resultados durante o después del campeonato",
            status_code=403,
        )
    if not (_is_admin_user(actor) or _is_commissioner_user(actor) or _is_educational_representative(actor)):
        raise ForbiddenError()
    match = await registration_repository.get_match_by_id(
        session, event_id=event_id, match_id=match_id
    )
    if not match:
        raise ApplicationError("Partido no encontrado", status_code=404)
    if not match.equipo_local_id or not match.equipo_visitante_id:
        raise ApplicationError(
            "El partido aún no tiene equipos definidos", status_code=400
        )
    match_datetime = None
    if match.fecha:
        base_time = match.hora or time(0, 0)
        match_datetime = datetime.combine(match.fecha, base_time, tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)
    if match_datetime and match_datetime > now:
        raise ApplicationError(
            "Solo puedes registrar resultados después de la hora programada del partido",
            status_code=400,
        )
    if _is_educational_representative(actor):
        actor_institution = getattr(actor, "institucion_id", None)
        if actor_institution is None:
            raise ApplicationError(
                "Tu usuario no está asociado a una institución", status_code=400
            )
        local_institution = getattr(
            getattr(match.equipo_local, "evento_institucion", None),
            "institucion_id",
            None,
        )
        visitor_institution = getattr(
            getattr(match.equipo_visitante, "evento_institucion", None),
            "institucion_id",
            None,
        )
        if actor_institution not in {local_institution, visitor_institution}:
            raise ForbiddenError()
    winner_id = int(payload.ganador_inscripcion_id)
    if winner_id not in {match.equipo_local_id, match.equipo_visitante_id}:
        raise ApplicationError(
            "El ganador debe ser uno de los equipos participantes", status_code=400
        )
    match.puntaje_local = payload.puntaje_local
    match.puntaje_visitante = payload.puntaje_visitante
    match.criterio_resultado = payload.criterio_resultado or "puntos"
    match.ganador_inscripcion_id = winner_id
    match.estado = "finalizado"
    loser_id = (
        match.equipo_visitante_id
        if winner_id == match.equipo_local_id
        else match.equipo_local_id
    )
    await registration_repository.propagate_match_result(
        session,
        event_id=event_id,
        llave=match.llave,
        ganador_id=winner_id,
        perdedor_id=loser_id,
    )
    await audit_service.log_event(
        session,
        entidad="eventos_partidos",
        accion="resultado_registrado",
        descripcion="Se registró el resultado de un partido",
        actor=actor,
        entidad_id=match.id,
        metadata={
            "ganador": winner_id,
            "criterio": match.criterio_resultado,
        },
    )
    news_meta: dict | None = None
    if payload.publicar_noticia and not match.noticia_publicada:
        news_meta = await _publish_match_news(
            session, event=event, match=match, actor=actor
        )
    await session.commit()
    await session.refresh(match)
    return map_fixture_match(match), news_meta


async def publish_match_news(
    session: AsyncSession,
    *,
    event_id: int,
    match_id: int,
    actor: UserBase | None = None,
) -> tuple[FixtureMatch, dict | None]:
    event = await event_repository.get_event_by_id(session, event_id)
    if not event or event.eliminado:
        raise ApplicationError("Evento no encontrado", status_code=404)
    if _is_commissioner_user(actor):
        allowed_sport = _resolve_commissioner_sport(actor)
        if int(event.deporte_id) != int(allowed_sport):
            raise ForbiddenError()
    stage = _calculate_event_stage(
        registration_start=event.fecha_inscripcion_inicio,
        registration_end=event.fecha_inscripcion_fin,
        audit_start=event.fecha_auditoria_inicio,
        audit_end=event.fecha_auditoria_fin,
        championship_start=event.fecha_campeonato_inicio,
        championship_end=event.fecha_campeonato_fin,
    )
    if stage not in {"campeonato", "finalizado"}:
        raise ApplicationError(
            "Solo se pueden publicar noticias durante o después del campeonato",
            status_code=403,
        )
    if not (_is_admin_user(actor) or _is_commissioner_user(actor) or _is_educational_representative(actor)):
        raise ForbiddenError()
    match = await registration_repository.get_match_by_id(
        session, event_id=event_id, match_id=match_id
    )
    if not match:
        raise ApplicationError("Partido no encontrado", status_code=404)
    if not match.equipo_local_id or not match.equipo_visitante_id:
        raise ApplicationError(
            "El partido aún no tiene equipos definidos", status_code=400
        )
    news_meta = await _publish_match_news(
        session, event=event, match=match, actor=actor
    )
    await session.commit()
    await session.refresh(match)
    return map_fixture_match(match), news_meta


def _calculate_standings(matches: Sequence[EventoPartido]) -> list[StandingTable]:
    standings: dict[str, dict[int, dict[str, int | str | None]]] = {}

    def _team_row(
        serie_key: str, team: EventoInscripcion | None
    ) -> dict[str, int | str | None]:
        team_id = getattr(team, "id", None)
        if team_id is None:
            return {}
        serie_table = standings.setdefault(serie_key, {})
        if team_id not in serie_table:
            institution = getattr(getattr(team, "evento_institucion", None), "institucion", None)
            serie_table[team_id] = {
                "equipo_id": team_id,
                "equipo_nombre": getattr(team, "nombre_equipo", None),
                "institucion_nombre": getattr(institution, "nombre", None),
                "puntos": 0,
                "partidos_jugados": 0,
                "ganados": 0,
                "empatados": 0,
                "perdidos": 0,
                "goles_a_favor": 0,
                "goles_en_contra": 0,
                "diferencia": 0,
            }
        return serie_table[team_id]

    for match in matches or []:
        if match.puntaje_local is None or match.puntaje_visitante is None:
            continue
        if not match.equipo_local or not match.equipo_visitante:
            continue
        serie_key = match.serie or "General"
        local_row = _team_row(serie_key, match.equipo_local)
        visitor_row = _team_row(serie_key, match.equipo_visitante)
        if not local_row or not visitor_row:
            continue
        local_score = int(match.puntaje_local)
        visitor_score = int(match.puntaje_visitante)
        local_row["partidos_jugados"] += 1
        visitor_row["partidos_jugados"] += 1
        local_row["goles_a_favor"] += local_score
        local_row["goles_en_contra"] += visitor_score
        visitor_row["goles_a_favor"] += visitor_score
        visitor_row["goles_en_contra"] += local_score

        local_result = "draw"
        visitor_result = "draw"
        winner_id = getattr(match, "ganador_inscripcion_id", None)
        if local_score != visitor_score:
            if winner_id == match.equipo_local_id:
                local_result, visitor_result = "win", "loss"
            elif winner_id == match.equipo_visitante_id:
                local_result, visitor_result = "loss", "win"
            elif local_score > visitor_score:
                local_result, visitor_result = "win", "loss"
            else:
                local_result, visitor_result = "loss", "win"

        if local_result == "win":
            local_row["ganados"] += 1
            local_row["puntos"] += 3
            visitor_row["perdidos"] += 1
        elif local_result == "loss":
            visitor_row["ganados"] += 1
            visitor_row["puntos"] += 3
            local_row["perdidos"] += 1
        else:
            local_row["empatados"] += 1
            visitor_row["empatados"] += 1
            local_row["puntos"] += 1
            visitor_row["puntos"] += 1

    tables: list[StandingTable] = []
    for serie, teams in standings.items():
        for values in teams.values():
            values["diferencia"] = values.get("goles_a_favor", 0) - values.get(
                "goles_en_contra", 0
            )
        ordered = sorted(
            teams.values(),
            key=lambda item: (
                -int(item.get("puntos", 0)),
                -int(item.get("diferencia", 0)),
                -int(item.get("goles_a_favor", 0)),
                (item.get("equipo_nombre") or "").lower(),
            ),
        )
        tables.append(
            StandingTable(
                serie=None if serie == "General" else serie,
                posiciones=[StandingRow(**values) for values in ordered],
            )
        )

    return sorted(tables, key=lambda item: item.serie or "General")


async def get_event_standings(
    session: AsyncSession,
    *,
    event_id: int,
    actor: UserBase | None = None,
) -> list[StandingTable]:
    event = await event_repository.get_event_by_id(session, event_id)
    if not event or event.eliminado:
        raise ApplicationError("Evento no encontrado", status_code=404)
    if _is_commissioner_user(actor):
        allowed_sport = _resolve_commissioner_sport(actor)
        if int(event.deporte_id) != int(allowed_sport):
            raise ForbiddenError()
    matches = await registration_repository.list_fixture(session, event_id=event_id)
    return _calculate_standings(matches)


async def get_event_schedule(
    session: AsyncSession,
    *,
    event_id: int,
    actor: UserBase | None = None,
) -> tuple[list[FixtureMatch], dict]:
    event = await event_repository.get_event_by_id(session, event_id)
    if not event or event.eliminado:
        raise ApplicationError("Evento no encontrado", status_code=404)
    if _is_commissioner_user(actor):
        allowed_sport = _resolve_commissioner_sport(actor)
        if int(event.deporte_id) != int(allowed_sport):
            raise ForbiddenError()
    matches = await registration_repository.list_fixture(session, event_id=event_id)
    eligible = collect_eligible_registrations(event)
    structure = determine_tournament_structure(len(eligible)) if eligible else scheduling_service.TournamentStructure(series=1, playoff_teams=0)
    meta = _build_schedule_meta(structure, matches)
    return [map_fixture_match(match) for match in matches], meta


async def generate_event_schedule(
    session: AsyncSession,
    *,
    event_id: int,
    payload: ScheduleRequest | None = None,
    actor: UserBase | None = None,
) -> list[FixtureMatch]:
    event = await event_repository.get_event_by_id(session, event_id)
    if not event or event.eliminado:
        raise ApplicationError("Evento no encontrado", status_code=404)
    if _is_commissioner_user(actor):
        allowed_sport = _resolve_commissioner_sport(actor)
        if int(event.deporte_id) != int(allowed_sport):
            raise ForbiddenError()
    stage = _calculate_event_stage(
        registration_start=event.fecha_inscripcion_inicio,
        registration_end=event.fecha_inscripcion_fin,
        audit_start=event.fecha_auditoria_inicio,
        audit_end=event.fecha_auditoria_fin,
        championship_start=event.fecha_campeonato_inicio,
        championship_end=event.fecha_campeonato_fin,
    )
    if stage != "campeonato":
        raise ApplicationError(
            "Solo se puede generar el calendario durante la etapa de campeonato",
            status_code=403,
        )

    request = payload or ScheduleRequest()
    config_model = getattr(event, "configuracion", None)
    override_config: ScheduleConfig | None = None
    has_override = any(
        value is not None
        for value in (
            request.hora_inicio,
            request.hora_fin,
            request.duracion_horas,
            request.descanso_min_dias,
        )
    )
    if has_override:
        base_start = request.hora_inicio or getattr(config_model, "hora_inicio", time(8, 0))
        base_end = request.hora_fin or getattr(config_model, "hora_fin", time(18, 0))
        base_duration = request.duracion_horas or getattr(config_model, "duracion_horas", 1)
        base_rest = request.descanso_min_dias or getattr(
            config_model, "descanso_min_dias", 0
        )
        override_config = ScheduleConfig(
            hora_inicio=base_start,
            hora_fin=base_end,
            duracion_horas=base_duration,
            descanso_min_dias=base_rest,
        )

    existing_matches = await registration_repository.list_fixture(
        session, event_id=event_id
    )
    eligible_registrations = collect_eligible_registrations(event)
    teams = [Team(id=reg.id, nombre=reg.nombre_equipo) for reg in eligible_registrations]
    if not teams:
        raise ApplicationError(
            "No hay inscripciones habilitadas para generar el calendario",
            status_code=400,
        )
    structure = determine_tournament_structure(len(teams))
    next_stage = _resolve_next_stage(structure, existing_matches)
    if not next_stage:
        raise ApplicationError(
            "No hay etapas pendientes o la fase actual aún no concluye",
            status_code=409,
        )

    assignments = scheduling_service._build_series_assignments(teams, structure.series)
    full_definitions = scheduling_service.build_matches(structure, assignments)
    target_phases = {next_stage}
    if next_stage == "final":
        target_phases.add("third_place")
    stage_definitions = [
        definition
        for definition in full_definitions
        if (definition.fase or "").lower() in target_phases
    ]

    team_lookup = {team.id: team for team in teams if team.id is not None}
    standings = compute_group_standings(existing_matches, team_lookup)
    global_rankings: list[scheduling_service.TeamStanding] = []
    for serie_standings in standings.values():
        global_rankings.extend(serie_standings)
    global_rankings.sort(key=scheduling_service._standing_sort_key)  # type: ignore[attr-defined]
    if not stage_definitions and next_stage == "final":
        all_ranked = global_rankings or [
            scheduling_service.TeamStanding(
                team=team_lookup.get(team.id, team), serie=None
            )
            for team in teams
        ]
        ordered = sorted(all_ranked, key=scheduling_service._standing_sort_key)  # type: ignore[attr-defined]
        if len(ordered) < 2:
            raise ApplicationError(
                "Se requieren al menos dos equipos para disputar la final",
                status_code=400,
            )
        stage_definitions.append(
            scheduling_service.MatchDefinition(
                internal_id=9999,
                code="FINAL",
                fase="final",
                serie=None,
                ronda="Final",
                local=ordered[0].team,
                visitante=ordered[1].team,
                placeholder_local=None,
                placeholder_visitante=None,
                is_playoff=True,
            )
        )
    used_seed_ids: set[int] = set()
    winners_map: dict[str, Team] = {}
    for match in existing_matches:
        code = getattr(match, "llave", None)
        status = (getattr(match, "estado", "") or "").lower()
        if not code or status != "finalizado":
            continue
        winner_id = getattr(match, "ganador_inscripcion_id", None)
        if winner_id:
            winner = team_lookup.get(winner_id, Team(id=winner_id, nombre="Ganador"))
            winners_map[f"Ganador {code}"] = winner
            loser_id = (
                match.equipo_visitante_id
                if winner_id == match.equipo_local_id
                else match.equipo_local_id
            )
            if loser_id:
                loser = team_lookup.get(loser_id, Team(id=loser_id, nombre="Perdedor"))
                winners_map[f"Perdedor {code}"] = loser

    prepared_definitions: list[scheduling_service.MatchDefinition] = []
    for definition in stage_definitions:
        local_team = definition.local
        visitor_team = definition.visitante
        placeholder_local = definition.placeholder_local
        placeholder_visitante = definition.placeholder_visitante
        if placeholder_local:
            resolved = winners_map.get(placeholder_local) or resolve_seed_team(
                placeholder_local, standings, global_rankings, used_seed_ids
            )
            if resolved:
                local_team = resolved
                placeholder_local = None
        if placeholder_visitante:
            resolved = winners_map.get(placeholder_visitante) or resolve_seed_team(
                placeholder_visitante, standings, global_rankings, used_seed_ids
            )
            if resolved:
                visitor_team = resolved
                placeholder_visitante = None
        if next_stage != "group" and (
            (local_team is None and placeholder_local is None)
            or (visitor_team is None and placeholder_visitante is None)
        ):
            raise ApplicationError(
                "Aún no se pueden definir los equipos clasificados para la siguiente fase",
                status_code=409,
            )
        prepared_definitions.append(
            scheduling_service.MatchDefinition(
                internal_id=definition.internal_id,
                code=definition.code,
                fase=definition.fase,
                serie=definition.serie,
                ronda=definition.ronda,
                local=local_team,
                visitante=visitor_team,
                placeholder_local=placeholder_local,
                placeholder_visitante=placeholder_visitante,
                is_playoff=definition.is_playoff,
            )
        )

    occupied_slots = {
        (match.fecha, match.hora, getattr(match, "escenario_evento_id", None))
        for match in existing_matches
        if getattr(match, "fecha", None) and getattr(match, "hora", None)
    }
    last_date = None
    for match in existing_matches:
        if getattr(match, "fecha", None) and (
            last_date is None or match.fecha > last_date
        ):
            last_date = match.fecha
    stage_start = event.fecha_campeonato_inicio
    if last_date:
        stage_start = max(event.fecha_campeonato_inicio, last_date + timedelta(days=1))

    matches = await schedule_stage_matches(
        session,
        event=event,
        matches=prepared_definitions,
        override_config=override_config,
        start_date=stage_start,
        exclude_slots=occupied_slots,
    )

    if not existing_matches:
        await persist_schedule(
            session,
            event=event,
            matches=matches,
            force=request.force,
        )
    else:
        await persist_additional_matches(
            session,
            event=event,
            matches=matches,
        )
    if override_config:
        await update_event_config(session, event=event, config=override_config)

    await audit_service.log_event(
        session,
        entidad="eventos_partidos",
        accion="generado",
        descripcion=f"Se generó el calendario para la fase {next_stage}",
        actor=actor,
        entidad_id=event.id,
        metadata={"partidos": len(matches), "fase": next_stage},
    )
    await session.commit()
    stored = await registration_repository.list_fixture(session, event_id=event_id)
    meta = _build_schedule_meta(structure, stored)
    return [map_fixture_match(match) for match in stored], meta


async def delete_event_schedule(
    session: AsyncSession,
    *,
    event_id: int,
    actor: UserBase | None = None,
) -> None:
    event = await event_repository.get_event_by_id(session, event_id)
    if not event or event.eliminado:
        raise ApplicationError("Evento no encontrado", status_code=404)
    if _is_commissioner_user(actor):
        allowed_sport = _resolve_commissioner_sport(actor)
        if int(event.deporte_id) != int(allowed_sport):
            raise ForbiddenError()
    matches = await session.execute(
        select(EventoPartido).where(EventoPartido.evento_id == event_id)
    )
    stored = matches.scalars().all()
    if not stored:
        return None
    if any((match.estado or "").lower() != "programado" for match in stored):
        raise ApplicationError(
            "No es posible eliminar el calendario porque hay partidos con resultados registrados",
            status_code=409,
        )
    await session.execute(
        delete(EventoPartido).where(EventoPartido.evento_id == event_id)
    )
    await audit_service.log_event(
        session,
        entidad="eventos_partidos",
        accion="eliminado",
        descripcion="Se eliminó el calendario del evento",
        actor=actor,
        entidad_id=event.id,
        metadata={"partidos": len(stored)},
    )
    await session.commit()
    return None


async def delete_event(
    session: AsyncSession, *, event_id: int, actor: UserBase | None = None
) -> None:
    event = await event_repository.get_event_by_id(session, event_id)
    if not event:
        raise ApplicationError("Evento no encontrado", status_code=404)

    if _is_commissioner_user(actor):
        allowed_sport = _resolve_commissioner_sport(actor)
        if int(event.deporte_id) != int(allowed_sport):
            raise ForbiddenError()

    stage_state = _resolve_event_state(
        _calculate_event_stage(
            registration_start=event.fecha_inscripcion_inicio,
            registration_end=event.fecha_inscripcion_fin,
            audit_start=event.fecha_auditoria_inicio,
            audit_end=event.fecha_auditoria_fin,
            championship_start=event.fecha_campeonato_inicio,
            championship_end=event.fecha_campeonato_fin,
            current_state=event.estado,
        ),
        event.estado,
    )
    history_states = {"inscripcion", "auditoria", "campeonato", "finalizado", "archivado"}
    previous_planning = None
    previous_cover = None

    if stage_state in history_states:
        await event_repository.logical_delete_event(session, event)
    else:
        previous_planning = event.documento_planeacion
        previous_cover = event.imagen_portada
        await event_repository.delete_event(session, event)

    await session.commit()

    if previous_planning:
        file_service.delete_media(previous_planning)
    if previous_cover:
        file_service.delete_media(previous_cover)


async def list_scenarios(
    session: AsyncSession,
    *,
    page: int,
    page_size: int,
    search: str | None = None,
    include_inactive: bool = False,
) -> tuple[list[Scenario], int]:
    scenarios, total = await scenario_repository.list_scenarios(
        session,
        page=page,
        page_size=page_size,
        search=search,
        include_inactive=include_inactive,
    )
    return [Scenario.model_validate(item) for item in scenarios], total


async def create_scenario(session: AsyncSession, payload: ScenarioCreate) -> Scenario:
    existing = await scenario_repository.get_scenario_by_name(
        session, payload.nombre, include_inactive=True
    )
    if existing:
        raise ApplicationError("Ya existe un escenario con ese nombre")
    scenario = await scenario_repository.create_scenario(
        session,
        nombre=payload.nombre,
        direccion=payload.direccion,
        ciudad=payload.ciudad,
        capacidad=payload.capacidad,
        foto_url=payload.foto_url,
    )
    await session.commit()
    await session.refresh(scenario)
    return Scenario.model_validate(scenario)


async def update_scenario(
    session: AsyncSession,
    scenario_id: int,
    payload: ScenarioUpdate,
) -> Scenario:
    scenario = await scenario_repository.get_scenario_by_id(session, scenario_id)
    if not scenario:
        raise ApplicationError("Escenario no encontrado", status_code=404)
    if payload.nombre and payload.nombre.lower() != scenario.nombre.lower():
        other = await scenario_repository.get_scenario_by_name(
            session, payload.nombre, include_inactive=True
        )
        if other and other.id != scenario.id:
            raise ApplicationError("Ya existe un escenario con ese nombre")
    await scenario_repository.update_scenario(
        session,
        scenario,
        nombre=payload.nombre,
        direccion=payload.direccion,
        ciudad=payload.ciudad,
        capacidad=payload.capacidad,
        foto_url=payload.foto_url,
        activo=payload.activo,
    )
    await session.commit()
    await session.refresh(scenario)
    return Scenario.model_validate(scenario)


async def delete_scenario(session: AsyncSession, scenario_id: int) -> None:
    scenario = await scenario_repository.get_scenario_by_id(session, scenario_id)
    if not scenario:
        raise ApplicationError("Escenario no encontrado", status_code=404)
    if not scenario.activo:
        raise ApplicationError("El escenario ya se encuentra deshabilitado", status_code=400)
    await scenario_repository.logical_delete_scenario(session, scenario)
    await session.commit()


async def restore_scenario(session: AsyncSession, scenario_id: int) -> Scenario:
    scenario = await scenario_repository.get_scenario_by_id(session, scenario_id)
    if not scenario:
        raise ApplicationError("Escenario no encontrado", status_code=404)
    if scenario.activo:
        raise ApplicationError("El escenario no está deshabilitado", status_code=400)
    await scenario_repository.restore_scenario(session, scenario)
    await session.commit()
    await session.refresh(scenario)
    return Scenario.model_validate(scenario)


async def delete_scenario_permanently(session: AsyncSession, scenario_id: int) -> None:
    scenario = await scenario_repository.get_scenario_by_id(session, scenario_id)
    if not scenario:
        raise ApplicationError("Escenario no encontrado", status_code=404)
    await scenario_repository.delete_scenario(session, scenario)
    await session.commit()


async def get_consolidated_history(
    session: AsyncSession,
    *,
    filters: HistoryFilters | None = None,
    page: int,
    page_size: int,
) -> tuple[list[HistoryRecord], int, dict]:
    filters = filters or HistoryFilters()
    entidades = [filters.entidad] if filters.entidad else None
    severidades = [filters.severidad] if filters.severidad else None
    events, total = await audit_service.list_events(
        session,
        page=page,
        page_size=page_size,
        search=(filters.search or None),
        entidades=entidades,
        severidades=severidades,
        order=filters.order,
    )

    records = [
        HistoryRecord(
            id=event.id,
            entidad=event.entidad,
            accion=event.accion,
            descripcion=event.descripcion,
            severidad=event.severidad,
            metadata=event.metadata,
            actor_id=event.actor_id,
            actor_nombre=event.actor_nombre,
            registrado_en=event.registrado_en,
        )
        for event in events
    ]

    available_entities = sorted({event.entidad for event in events})
    available_severities = sorted({(event.severidad or "info").lower() for event in events})

    extra = {
        "entidades": available_entities,
        "severidades": available_severities,
        "orden": filters.order,
    }

    return records, total, extra


async def get_settings(session: AsyncSession) -> AppConfigSchema | None:
    settings_model = await config_repository.get_app_settings(session)
    if not settings_model:
        return None
    return AppConfigSchema.model_validate(settings_model)


async def update_settings(
    session: AsyncSession,
    *,
    branding_name: str,
    support_email: str,
    maintenance_mode: bool,
) -> AppConfigSchema:
    model = await config_repository.upsert_app_settings(
        session,
        branding_name=branding_name,
        support_email=support_email,
        maintenance_mode=maintenance_mode,
    )
    await session.commit()
    return AppConfigSchema.model_validate(model)


def _normalize_catalog_name(value: str) -> str:
    return (value or "").strip()


def _validate_category_age_range(
    minimum: int | None, maximum: int | None
) -> tuple[int | None, int | None]:
    for label, value in (("mínima", minimum), ("máxima", maximum)):
        if value is None:
            continue
        if value < 0:
            raise ApplicationError(f"La edad {label} no puede ser negativa")
        if value > 120:
            raise ApplicationError(f"La edad {label} no puede superar los 120 años")
    if minimum is not None and maximum is not None and minimum > maximum:
        raise ApplicationError(
            "La edad máxima debe ser mayor o igual a la edad mínima"
        )
    return minimum, maximum


async def list_sports_for_management(session: AsyncSession) -> list[SportConfig]:
    sports = await sport_repository.list_sports(
        session, include_inactive=True
    )
    return [SportConfig.model_validate(item) for item in sports]


async def create_sport(
    session: AsyncSession, payload: SportCreateRequest
) -> SportConfig:
    normalized_name = _normalize_catalog_name(payload.nombre)
    if not normalized_name:
        raise ApplicationError("El nombre del deporte es obligatorio")

    existing = await sport_repository.get_sport_by_name(
        session, normalized_name
    )
    if existing:
        raise ApplicationError("Ya existe un deporte con ese nombre")

    sport = await sport_repository.create_sport(
        session, nombre=normalized_name, activo=payload.activo
    )
    await session.commit()
    await session.refresh(sport)
    return SportConfig.model_validate(sport)


async def update_sport(
    session: AsyncSession, sport_id: int, payload: SportUpdateRequest
) -> SportConfig:
    sport = await sport_repository.get_sport_by_id(
        session, sport_id, include_inactive=True
    )
    if not sport:
        raise ApplicationError("Deporte no encontrado", status_code=404)

    data = payload.model_dump(exclude_unset=True)
    name_provided = "nombre" in data
    active_provided = "activo" in data

    new_name: str | None = None
    if name_provided:
        normalized_name = _normalize_catalog_name(data.get("nombre"))
        if not normalized_name:
            raise ApplicationError("El nombre del deporte es obligatorio")
        existing = await sport_repository.get_sport_by_name(
            session, normalized_name
        )
        if existing and existing.id != sport.id:
            raise ApplicationError("Ya existe un deporte con ese nombre")
        new_name = normalized_name

    new_active = data.get("activo") if active_provided else None

    await sport_repository.update_sport(
        session,
        sport,
        nombre=new_name if name_provided else None,
        activo=new_active if active_provided else None,
    )
    await session.commit()
    await session.refresh(sport)
    return SportConfig.model_validate(sport)


async def list_categories_for_management(
    session: AsyncSession, *, deporte_id: int | None = None
) -> list[CategoryConfig]:
    categories = await category_repository.list_categories(
        session, deporte_id=deporte_id, include_inactive=True
    )
    return [CategoryConfig.model_validate(item) for item in categories]


async def create_category(
    session: AsyncSession, payload: CategoryCreateRequest
) -> CategoryConfig:
    sport = await sport_repository.get_sport_by_id(
        session, payload.deporte_id, include_inactive=True
    )
    if not sport:
        raise ApplicationError("El deporte seleccionado no existe", status_code=404)

    normalized_name = _normalize_catalog_name(payload.nombre)
    if not normalized_name:
        raise ApplicationError("El nombre de la categoría es obligatorio")

    existing = await category_repository.get_category_by_name(
        session,
        deporte_id=sport.id,
        nombre=normalized_name,
    )
    if existing:
        raise ApplicationError(
            "Ya existe una categoría con ese nombre para este deporte"
        )

    min_age, max_age = _validate_category_age_range(
        payload.edad_minima, payload.edad_maxima
    )

    category = await category_repository.create_category(
        session,
        deporte_id=sport.id,
        nombre=normalized_name,
        edad_minima=min_age,
        edad_maxima=max_age,
        activo=payload.activo,
    )
    await session.commit()
    await session.refresh(category)
    return CategoryConfig.model_validate(category)


async def update_category(
    session: AsyncSession, category_id: int, payload: CategoryUpdateRequest
) -> CategoryConfig:
    category = await category_repository.get_category_by_id(
        session, category_id, include_inactive=True
    )
    if not category:
        raise ApplicationError("Categoría no encontrada", status_code=404)

    data = payload.model_dump(exclude_unset=True)
    name_provided = "nombre" in data
    min_provided = "edad_minima" in data
    max_provided = "edad_maxima" in data
    active_provided = "activo" in data

    new_name = category.nombre
    if name_provided:
        new_name = _normalize_catalog_name(data.get("nombre"))
        if not new_name:
            raise ApplicationError("El nombre de la categoría es obligatorio")
        existing = await category_repository.get_category_by_name(
            session,
            deporte_id=category.deporte_id,
            nombre=new_name,
        )
        if existing and existing.id != category.id:
            raise ApplicationError(
                "Ya existe una categoría con ese nombre para este deporte"
            )

    new_min = data.get("edad_minima") if min_provided else category.edad_minima
    new_max = data.get("edad_maxima") if max_provided else category.edad_maxima
    _validate_category_age_range(new_min, new_max)

    await category_repository.update_category(
        session,
        category,
        nombre=new_name if name_provided else None,
        edad_minima=new_min if min_provided else None,
        edad_minima_set=min_provided,
        edad_maxima=new_max if max_provided else None,
        edad_maxima_set=max_provided,
        activo=data.get("activo") if active_provided else None,
    )
    await session.commit()
    await session.refresh(category)
    return CategoryConfig.model_validate(category)


async def list_roles(session: AsyncSession) -> list[RoleBase]:
    roles = await role_repository.list_roles(session)
    return [RoleBase.model_validate(role) for role in roles]


async def create_role(session: AsyncSession, payload: RoleCreate) -> RoleBase:
    existing = await role_repository.get_role_by_name(session, payload.nombre)
    if existing:
        raise ApplicationError("Ya existe un rol con ese nombre")
    role = await role_repository.create_role(
        session,
        nombre=payload.nombre,
        descripcion=payload.descripcion,
    )
    await session.commit()
    await session.refresh(role)
    return RoleBase.model_validate(role)


async def update_role(session: AsyncSession, role_id: int, payload: RoleUpdate) -> RoleBase:
    role = await role_repository.get_role_by_id(session, role_id)
    if not role:
        raise ApplicationError("Rol no encontrado", status_code=404)

    if payload.nombre and payload.nombre != role.nombre:
        existing = await role_repository.get_role_by_name(session, payload.nombre)
        if existing and existing.id != role.id:
            raise ApplicationError("Ya existe un rol con ese nombre")

    await role_repository.update_role(
        session,
        role,
        nombre=payload.nombre,
        descripcion=payload.descripcion,
    )
    await session.commit()
    await session.refresh(role)
    return RoleBase.model_validate(role)


async def delete_role(session: AsyncSession, role_id: int) -> None:
    role = await role_repository.get_role_by_id(session, role_id)
    if not role:
        raise ApplicationError("Rol no encontrado", status_code=404)
    await role_repository.delete_role(session, role)
    await session.commit()


def _slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value or "")
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", ascii_value)
    slug = slug.strip("-").lower()
    return slug or "noticia"


async def _generate_unique_slug(
    session: AsyncSession, base_slug: str, *, exclude_id: int | None = None
) -> str:
    candidate = base_slug
    suffix = 2
    while True:
        existing = await news_repository.get_news_by_slug(session, candidate)
        if not existing or (exclude_id is not None and existing.id == exclude_id):
            return candidate
        candidate = f"{base_slug}-{suffix}"
        suffix += 1


def _normalize_tags(values: list[str] | None) -> list[str]:
    normalized: list[str] = []
    for item in values or []:
        if not isinstance(item, str):
            continue
        clean = item.strip()
        if clean and clean not in normalized:
            normalized.append(clean)
    return normalized


def _normalize_category(value: str | None) -> str | None:
    if value is None:
        return None
    clean = value.strip()
    return clean or None


def _normalize_state(state: str | None, *, current: str | None = None) -> str:
    candidate = (state or current or "borrador").strip().lower()
    if candidate not in NEWS_STATES:
        raise ApplicationError("El estado de la noticia no es válido", status_code=400)
    return candidate


def _ensure_aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _resolve_publication_date(state: str, value: datetime | None) -> datetime | None:
    now = datetime.now(timezone.utc)
    if state == "borrador":
        return None
    if state == "archivado":
        return value
    if state == "programado":
        if value is None:
            raise ApplicationError(
                "Debes especificar la fecha de publicación programada", status_code=400
            )
        if value <= now:
            raise ApplicationError(
                "La fecha programada debe ser posterior al momento actual", status_code=400
            )
        return value
    # publicado
    return value or now


def _validate_required_text(value: str | None, field: str) -> str:
    if value is None or not value.strip():
        raise ApplicationError(f"El campo {field} es obligatorio", status_code=400)
    return value.strip()


async def list_public_news(
    session: AsyncSession,
    *,
    page: int,
    page_size: int,
    search: str | None = None,
    categoria: str | None = None,
    destacado: bool | None = None,
    tags: list[str] | None = None,
    fecha_desde: datetime | None = None,
    fecha_hasta: datetime | None = None,
    order_by: str | None = None,
) -> tuple[list[News], int, dict]:
    normalized_tags = _normalize_tags(tags)
    categoria_clean = _normalize_category(categoria)
    noticias, total = await news_repository.list_news(
        session,
        page=page,
        page_size=page_size,
        search=search,
        categoria=categoria_clean,
        destacado=destacado,
        tags=normalized_tags,
        fecha_desde=_ensure_aware(fecha_desde),
        fecha_hasta=_ensure_aware(fecha_hasta),
        only_visible=True,
        order_by=order_by or "fecha_publicacion",
        order_desc=True,
    )
    categories = await news_repository.list_distinct_categories(session, only_visible=True)
    tag_values = await news_repository.list_distinct_tags(session, only_visible=True)
    extra = {"categories": categories, "tags": tag_values}
    return [map_news(item) for item in noticias], total, extra


async def list_manage_news(
    session: AsyncSession,
    *,
    page: int,
    page_size: int,
    search: str | None = None,
    estados: list[str] | None = None,
    categoria: str | None = None,
    destacado: bool | None = None,
    tags: list[str] | None = None,
    autor_ids: list[int] | None = None,
    fecha_desde: datetime | None = None,
    fecha_hasta: datetime | None = None,
    order_by: str | None = None,
    order_desc: bool = True,
) -> tuple[list[News], int, dict]:
    normalized_states = None
    if estados:
        normalized_states = []
        for state in estados:
            normalized_states.append(_normalize_state(state))
    noticias, total = await news_repository.list_news(
        session,
        page=page,
        page_size=page_size,
        search=search,
        estados=normalized_states,
        categoria=_normalize_category(categoria),
        destacado=destacado,
        tags=_normalize_tags(tags),
        autor_ids=autor_ids,
        fecha_desde=_ensure_aware(fecha_desde),
        fecha_hasta=_ensure_aware(fecha_hasta),
        only_visible=False,
        order_by=order_by or "fecha_publicacion",
        order_desc=order_desc,
    )
    categories = await news_repository.list_distinct_categories(session, only_visible=False)
    tag_values = await news_repository.list_distinct_tags(session, only_visible=False)
    extra = {"categories": categories, "tags": tag_values, "states": list(NEWS_STATES)}
    return [map_news(item) for item in noticias], total, extra


async def create_news(
    session: AsyncSession,
    *,
    autor_id: int,
    payload: NewsCreate,
) -> News:
    titulo = _validate_required_text(payload.titulo, "titulo")
    contenido = _validate_required_text(payload.contenido, "contenido")
    resumen = payload.resumen.strip() if isinstance(payload.resumen, str) else None
    categoria = _normalize_category(payload.categoria)
    etiquetas = _normalize_tags(payload.etiquetas)
    estado = _normalize_state(payload.estado)
    orden = payload.orden if payload.orden is not None else 0

    slug_source = payload.slug.strip() if isinstance(payload.slug, str) else ""
    if not slug_source:
        slug_source = titulo
    slug = await _generate_unique_slug(session, _slugify(slug_source))

    fecha_publicacion = _ensure_aware(payload.fecha_publicacion)
    fecha_publicacion = _resolve_publication_date(estado, fecha_publicacion)

    noticia = await news_repository.create_news(
        session,
        titulo=titulo,
        slug=slug,
        resumen=resumen,
        contenido=contenido,
        categoria=categoria,
        etiquetas=etiquetas,
        estado=estado,
        destacado=bool(payload.destacado),
        orden=orden,
        fecha_publicacion=fecha_publicacion,
        autor_id=autor_id,
    )
    await session.commit()
    return map_news(noticia)


async def update_news(
    session: AsyncSession,
    *,
    news_id: int,
    payload: NewsUpdate,
) -> News:
    noticia = await news_repository.get_news_by_id(session, news_id)
    if not noticia:
        raise ApplicationError("Noticia no encontrada", status_code=404)

    fields_set = payload.model_fields_set

    titulo = None
    if "titulo" in fields_set:
        titulo = _validate_required_text(payload.titulo, "titulo") if payload.titulo is not None else None

    contenido = None
    if "contenido" in fields_set:
        contenido = _validate_required_text(payload.contenido, "contenido") if payload.contenido is not None else None

    resumen = None
    if "resumen" in fields_set:
        resumen = payload.resumen.strip() if isinstance(payload.resumen, str) else None

    categoria = None
    if "categoria" in fields_set:
        categoria = _normalize_category(payload.categoria)

    etiquetas = None
    if "etiquetas" in fields_set:
        etiquetas = _normalize_tags(payload.etiquetas)

    estado = _normalize_state(payload.estado, current=noticia.estado)

    slug_value = None
    if "slug" in fields_set:
        slug_source = payload.slug.strip() if isinstance(payload.slug, str) else ""
        if not slug_source:
            slug_source = titulo or noticia.titulo
        slug_candidate = _slugify(slug_source)
        if slug_candidate != noticia.slug:
            slug_value = await _generate_unique_slug(session, slug_candidate, exclude_id=noticia.id)
    elif titulo is not None:
        slug_candidate = _slugify(titulo)
        if slug_candidate != noticia.slug:
            slug_value = await _generate_unique_slug(session, slug_candidate, exclude_id=noticia.id)

    fecha_publicacion = noticia.fecha_publicacion
    if "fecha_publicacion" in fields_set:
        fecha_publicacion = _ensure_aware(payload.fecha_publicacion)
    if "estado" in fields_set or "fecha_publicacion" in fields_set:
        fecha_publicacion = _resolve_publication_date(estado, fecha_publicacion)

    orden = None
    if "orden" in fields_set and payload.orden is not None:
        orden = payload.orden

    noticia = await news_repository.update_news(
        session,
        noticia,
        titulo=titulo,
        resumen=resumen,
        contenido=contenido,
        categoria=categoria,
        etiquetas=etiquetas,
        estado=estado,
        destacado=payload.destacado if "destacado" in fields_set else None,
        orden=orden,
        fecha_publicacion=fecha_publicacion,
        slug=slug_value,
        autor_id=payload.autor_id if "autor_id" in fields_set else None,
    )
    await session.commit()
    return map_news(noticia)


async def change_news_state(
    session: AsyncSession,
    *,
    news_id: int,
    payload: NewsStateUpdate,
) -> News:
    noticia = await news_repository.get_news_by_id(session, news_id)
    if not noticia:
        raise ApplicationError("Noticia no encontrada", status_code=404)

    estado = _normalize_state(payload.estado, current=noticia.estado)
    fecha_publicacion = _ensure_aware(payload.fecha_publicacion)
    fecha_publicacion = _resolve_publication_date(estado, fecha_publicacion or noticia.fecha_publicacion)

    noticia = await news_repository.update_news(
        session,
        noticia,
        estado=estado,
        fecha_publicacion=fecha_publicacion,
    )
    await session.commit()
    return map_news(noticia)


async def delete_news(session: AsyncSession, *, news_id: int) -> None:
    noticia = await news_repository.get_news_by_id(session, news_id)
    if not noticia:
        raise ApplicationError("Noticia no encontrada", status_code=404)
    await news_repository.delete_news(session, noticia)
    await session.commit()


async def get_public_news(session: AsyncSession, *, slug: str) -> News:
    noticia = await news_repository.get_news_by_slug(session, slug, only_visible=True)
    if not noticia:
        raise ApplicationError("Noticia no encontrada", status_code=404)
    return map_news(noticia)


async def get_manage_news(session: AsyncSession, *, news_id: int) -> News:
    noticia = await news_repository.get_news_by_id(session, news_id)
    if not noticia:
        raise ApplicationError("Noticia no encontrada", status_code=404)
    return map_news(noticia)
