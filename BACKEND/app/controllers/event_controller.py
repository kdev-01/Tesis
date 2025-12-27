from __future__ import annotations

from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from app.services import data_service
from fastapi import UploadFile

from app.schemas.event import EventCreate, EventTimelineUpdate, EventUpdate
from app.schemas.user import UserBase
from app.schemas.registration import (
    AuditDecisionBatchPayload,
    AuditDecisionPayload,
    FixtureMatch,
    FixturePayload,
    MatchResultPayload,
    StandingTable,
    InvitationSummary,
    InvitationNotificationPayload,
    InvitationNotificationResult,
    RegistrationExtensionPayload,
    RegistrationPayload,
    RegistrationSnapshot,
    RegistrationStudentDocument,
    StudentDocumentBatchResult,
    StudentDocumentBatchUpload,
    StudentDocumentReviewPayload,
    StudentDocumentType,
    EventInstitutionCreate,
)
from app.schemas.schedule import ScheduleRequest


async def list_events(
    session: AsyncSession,
    *,
    page: int,
    page_size: int,
    search: str | None = None,
    deporte_id: int | None = None,
    actor: UserBase | None = None,
):
    return await data_service.list_events(
        session,
        page=page,
        page_size=page_size,
        search=search,
        deporte_id=deporte_id,
        actor=actor,
    )


async def get_event_detail(
    session: AsyncSession,
    *,
    event_id: int,
    actor: UserBase | None = None,
    include_institutions: bool = True,
):
    return await data_service.get_event_detail(
        session,
        event_id=event_id,
        actor=actor,
        include_institutions=include_institutions,
    )


def list_student_document_types() -> list[StudentDocumentType]:
    return data_service.list_student_document_types()


async def list_sports(session: AsyncSession, *, actor: UserBase | None = None):
    return await data_service.list_sports(session, actor=actor)


async def list_categories_by_sport(
    session: AsyncSession,
    *,
    deporte_id: int,
    actor: UserBase | None = None,
):
    return await data_service.list_categories_by_sport(
        session, deporte_id=deporte_id, actor=actor
    )


async def get_event_current_stage(
    session: AsyncSession, *, event_id: int, fecha_hoy: date | None = None
):
    return await data_service.get_event_current_stage(
        session, event_id=event_id, fecha_hoy=fecha_hoy
    )


async def create_event(
    session: AsyncSession,
    *,
    administrador_id: int,
    payload: EventCreate,
    planning_document: UploadFile | None = None,
    cover_image: UploadFile | None = None,
    actor: UserBase | None = None,
):
    return await data_service.create_event(
        session,
        administrador_id=administrador_id,
        payload=payload,
        planning_document=planning_document,
        cover_image=cover_image,
        actor=actor,
    )


async def update_event(
    session: AsyncSession,
    *,
    event_id: int,
    payload: EventUpdate,
    planning_document: UploadFile | None = None,
    cover_image: UploadFile | None = None,
    actor: UserBase | None = None,
):
    return await data_service.update_event(
        session,
        event_id=event_id,
        payload=payload,
        planning_document=planning_document,
        cover_image=cover_image,
        actor=actor,
    )


async def update_event_timeline(
    session: AsyncSession,
    *,
    event_id: int,
    payload: EventTimelineUpdate,
    actor: UserBase | None = None,
):
    return await data_service.update_event_timeline(
        session, event_id=event_id, payload=payload, actor=actor
    )


async def delete_event(
    session: AsyncSession,
    *,
    event_id: int,
    actor: UserBase | None = None,
) -> None:
    await data_service.delete_event(session, event_id=event_id, actor=actor)


async def list_invitations_for_institution(
    session: AsyncSession, *, institucion_id: int
) -> list[InvitationSummary]:
    return await data_service.list_invitations_for_institution(
        session, institucion_id=institucion_id
    )


async def list_invitations_for_event(
    session: AsyncSession,
    *,
    event_id: int,
    actor: UserBase | None = None,
) -> list[InvitationSummary]:
    return await data_service.list_invitations_for_event(
        session, event_id=event_id, actor=actor
    )


async def add_event_institution(
    session: AsyncSession,
    *,
    event_id: int,
    payload: EventInstitutionCreate,
    actor: UserBase | None = None,
) -> InvitationSummary:
    return await data_service.add_event_institution(
        session, event_id=event_id, payload=payload, actor=actor
    )


async def remove_event_institution(
    session: AsyncSession,
    *,
    event_id: int,
    institucion_id: int,
    actor: UserBase | None = None,
) -> None:
    await data_service.remove_event_institution(
        session, event_id=event_id, institucion_id=institucion_id, actor=actor
    )


async def notify_event_institution(
    session: AsyncSession,
    *,
    event_id: int,
    institucion_id: int,
    payload: InvitationNotificationPayload,
    actor: UserBase | None = None,
) -> InvitationNotificationResult:
    return await data_service.send_event_institution_notification(
        session,
        event_id=event_id,
        institucion_id=institucion_id,
        payload=payload,
        actor=actor,
    )


async def accept_event_invitation(
    session: AsyncSession,
    *,
    event_id: int,
    institucion_id: int,
    actor: UserBase | None = None,
) -> InvitationSummary:
    return await data_service.accept_event_invitation(
        session,
        event_id=event_id,
        institucion_id=institucion_id,
        actor=actor,
    )


async def reject_event_invitation(
    session: AsyncSession,
    *,
    event_id: int,
    institucion_id: int,
    actor: UserBase | None = None,
) -> InvitationSummary:
    return await data_service.reject_event_invitation(
        session,
        event_id=event_id,
        institucion_id=institucion_id,
        actor=actor,
    )


async def get_institution_registration(
    session: AsyncSession, *, event_id: int, institucion_id: int
) -> RegistrationSnapshot:
    return await data_service.get_institution_registration(
        session, event_id=event_id, institucion_id=institucion_id
    )


async def save_institution_registration(
    session: AsyncSession,
    *,
    event_id: int,
    institucion_id: int,
    payload: RegistrationPayload,
    actor: UserBase | None = None,
) -> RegistrationSnapshot:
    return await data_service.save_institution_registration(
        session,
        event_id=event_id,
        institucion_id=institucion_id,
        payload=payload,
        actor=actor,
    )


async def extend_institution_registration(
    session: AsyncSession,
    *,
    event_id: int,
    institucion_id: int,
    payload: RegistrationExtensionPayload,
    actor: UserBase | None = None,
) -> RegistrationSnapshot:
    return await data_service.extend_institution_registration(
        session,
        event_id=event_id,
        institucion_id=institucion_id,
        payload=payload,
        actor=actor,
    )


async def audit_institution_registration(
    session: AsyncSession,
    *,
    event_id: int,
    institucion_id: int,
    payload: AuditDecisionPayload,
    actor: UserBase,
) -> InvitationSummary:
    return await data_service.audit_institution_registration(
        session,
        event_id=event_id,
        institucion_id=institucion_id,
        payload=payload,
        actor=actor,
    )


async def audit_institutions_registration_batch(
    session: AsyncSession,
    *,
    event_id: int,
    payload: AuditDecisionBatchPayload,
    actor: UserBase,
) -> list[InvitationSummary]:
    return await data_service.audit_institutions_registration_batch(
        session,
        event_id=event_id,
        payload=payload,
        actor=actor,
    )


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
    return await data_service.upload_student_document(
        session,
        event_id=event_id,
        institucion_id=institucion_id,
        estudiante_id=estudiante_id,
        tipo_documento=tipo_documento,
        archivo=archivo,
        actor=actor,
    )


async def upload_student_documents_batch(
    session: AsyncSession,
    *,
    event_id: int,
    institucion_id: int,
    payload: StudentDocumentBatchUpload,
    archivos: list[UploadFile],
    actor: UserBase | None = None,
) -> StudentDocumentBatchResult:
    return await data_service.upload_student_documents_batch(
        session,
        event_id=event_id,
        institucion_id=institucion_id,
        payload=payload,
        archivos=archivos,
        actor=actor,
    )


async def review_institution_documents(
    session: AsyncSession,
    *,
    event_id: int,
    institucion_id: int,
    payload: StudentDocumentReviewPayload,
    actor: UserBase,
) -> RegistrationSnapshot:
    return await data_service.review_institution_documents(
        session,
        event_id=event_id,
        institucion_id=institucion_id,
        payload=payload,
        actor=actor,
    )


async def list_event_fixture(
    session: AsyncSession,
    *,
    event_id: int,
    actor: UserBase | None = None,
) -> list[FixtureMatch]:
    return await data_service.list_event_fixture(
        session, event_id=event_id, actor=actor
    )


async def update_event_fixture(
    session: AsyncSession,
    *,
    event_id: int,
    payload: FixturePayload,
    actor: UserBase | None = None,
):
    return await data_service.update_event_fixture(
        session,
        event_id=event_id,
        payload=payload,
        actor=actor,
    )


async def register_match_result(
    session: AsyncSession,
    *,
    event_id: int,
    match_id: int,
    payload: MatchResultPayload,
    actor: UserBase | None = None,
) -> tuple[FixtureMatch, dict | None]:
    return await data_service.register_match_result(
        session,
        event_id=event_id,
        match_id=match_id,
        payload=payload,
        actor=actor,
    )


async def publish_match_news(
    session: AsyncSession,
    *,
    event_id: int,
    match_id: int,
    actor: UserBase | None = None,
) -> tuple[FixtureMatch, dict | None]:
    return await data_service.publish_match_news(
        session,
        event_id=event_id,
        match_id=match_id,
        actor=actor,
    )


async def get_event_schedule(
    session: AsyncSession,
    *,
    event_id: int,
    actor: UserBase | None = None,
) -> tuple[list[FixtureMatch], dict]:
    return await data_service.get_event_schedule(
        session, event_id=event_id, actor=actor
    )


async def get_event_standings(
    session: AsyncSession,
    *,
    event_id: int,
    actor: UserBase | None = None,
) -> list[StandingTable]:
    return await data_service.get_event_standings(
        session, event_id=event_id, actor=actor
    )


async def generate_event_schedule(
    session: AsyncSession,
    *,
    event_id: int,
    payload: ScheduleRequest | None = None,
    actor: UserBase | None = None,
) -> tuple[list[FixtureMatch], dict]:
    return await data_service.generate_event_schedule(
        session,
        event_id=event_id,
        payload=payload,
        actor=actor,
    )


async def delete_event_schedule(
    session: AsyncSession,
    *,
    event_id: int,
    actor: UserBase | None = None,
) -> None:
    await data_service.delete_event_schedule(
        session,
        event_id=event_id,
        actor=actor,
    )
    return None
