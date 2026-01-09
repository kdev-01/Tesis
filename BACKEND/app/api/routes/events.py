from __future__ import annotations

import json
from datetime import date
from json import JSONDecodeError
from pydantic import ValidationError

from fastapi import APIRouter, Depends, File, Form, Query, Request, Response, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_optional_user, require_roles
from app.controllers import event_controller
from app.core.database import get_session
from app.core.exceptions import ApplicationError, ForbiddenError, UnauthorizedError
from app.schemas.common import Meta, ResponseEnvelope
from app.schemas.event import (
    Category,
    Event,
    EventCreate,
    EventTimelineUpdate,
    EventUpdate,
    Sport,
)
from app.schemas.registration import (
    AuditDecisionPayload,
    AuditDecisionBatchPayload,
    FixtureMatch,
    FixturePayload,
    StandingTable,
    MatchResultPayload,
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
from app.schemas.results import MatchResultConfig, RegisterResultRequest
from app.services.result_service import result_service
from app.schemas.schedule import ScheduleRequest
from app.schemas.user import UserBase

router = APIRouter(prefix="/events", tags=["events"])


def _has_role(user: UserBase | None, role_name: str) -> bool:
    target = role_name.strip().lower()
    return bool(
        user and any((rol or "").strip().lower() == target for rol in getattr(user, "roles", []))
    )


async def _parse_event_payload(
    request: Request, schema: type[EventCreate] | type[EventUpdate]
):
    form = await request.form()
    metadata_raw = form.get("metadata")
    if metadata_raw is None:
        raise ApplicationError("Falta la información del evento", status_code=400)
    try:
        metadata = json.loads(metadata_raw)
    except (TypeError, JSONDecodeError) as exc:  # noqa: PERF203
        raise ApplicationError("La información del evento no es válida", status_code=400) from exc

    planning_file = form.get("planning_document")
    cover_file = form.get("cover_image")

    if getattr(planning_file, "filename", None) in {None, ""}:
        planning_file = None
    if getattr(cover_file, "filename", None) in {None, ""}:
        cover_file = None

    payload = schema.model_validate(metadata)
    return payload, planning_file, cover_file


@router.get("/", response_model=ResponseEnvelope[list[Event]])
async def list_events(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    search: str | None = Query(None),
    deporte_id: int | None = Query(None),
    manageable: bool = Query(False),
    session: AsyncSession = Depends(get_session),
    current_user: UserBase | None = Depends(get_optional_user),
) -> ResponseEnvelope[list[Event]]:
    sport_filter = deporte_id
    if manageable:
        if current_user is None:
            raise UnauthorizedError("No se pudo validar tu sesión")
        if not (_has_role(current_user, "Administrador") or _has_role(current_user, "Representante de comisión")):
            raise ForbiddenError()
        if _has_role(current_user, "Representante de comisión"):
            if current_user.deporte_id is None:
                raise ApplicationError(
                    "Tu usuario no tiene un deporte asignado",
                    status_code=400,
                )
            sport_filter = int(current_user.deporte_id)
    events, total = await event_controller.list_events(
        session,
        page=page,
        page_size=page_size,
        search=search,
        deporte_id=sport_filter,
        actor=current_user,
    )
    meta = Meta(total=total, page=page, page_size=page_size)
    return ResponseEnvelope(data=events, meta=meta)


@router.get(
    "/documents/types",
    response_model=ResponseEnvelope[list[StudentDocumentType]],
)
async def list_document_types() -> ResponseEnvelope[list[StudentDocumentType]]:
    types = event_controller.list_student_document_types()
    return ResponseEnvelope(data=types)


@router.get("/sports", response_model=ResponseEnvelope[list[Sport]])
async def list_sports(
    session: AsyncSession = Depends(get_session),
    user: UserBase = Depends(require_roles("Administrador", "Representante de comisión")),
) -> ResponseEnvelope[list[Sport]]:
    sports = await event_controller.list_sports(session, actor=user)
    return ResponseEnvelope(data=sports)


@router.get(
    "/sports/{sport_id}/categories",
    response_model=ResponseEnvelope[list[Category]],
)
async def list_categories(
    sport_id: int,
    session: AsyncSession = Depends(get_session),
    user: UserBase = Depends(require_roles("Administrador", "Representante de comisión")),
) -> ResponseEnvelope[list[Category]]:
    if _has_role(user, "Representante de comisión"):
        if user.deporte_id is None:
            raise ApplicationError(
                "Tu usuario no tiene un deporte asignado",
                status_code=400,
            )
        if int(user.deporte_id) != int(sport_id):
            raise ForbiddenError()
    categories = await event_controller.list_categories_by_sport(
        session, deporte_id=sport_id, actor=user
    )
    return ResponseEnvelope(data=categories)


@router.get("/{event_id}", response_model=ResponseEnvelope[Event])
async def get_event_detail(
    event_id: int,
    include_institutions: bool = Query(True),
    session: AsyncSession = Depends(get_session),
    current_user: UserBase | None = Depends(get_optional_user),
) -> ResponseEnvelope[Event]:
    event = await event_controller.get_event_detail(
        session,
        event_id=event_id,
        actor=current_user,
        include_institutions=include_institutions,
    )
    return ResponseEnvelope(data=event)


@router.post("/", response_model=ResponseEnvelope[Event], status_code=status.HTTP_201_CREATED)
async def create_event(
    request: Request,
    session: AsyncSession = Depends(get_session),
    user: UserBase = Depends(require_roles("Administrador", "Representante de comisión")),
) -> ResponseEnvelope[Event]:
    payload, planning_document, cover_image = await _parse_event_payload(request, EventCreate)
    event = await event_controller.create_event(
        session,
        administrador_id=user.id,
        payload=payload,
        planning_document=planning_document,
        cover_image=cover_image,
        actor=user,
    )
    return ResponseEnvelope(data=event)


@router.get(
    "/invitations/me",
    response_model=ResponseEnvelope[list[InvitationSummary]],
)
async def list_my_invitations(
    session: AsyncSession = Depends(get_session),
    user: UserBase = Depends(require_roles("Representante educativo")),
) -> ResponseEnvelope[list[InvitationSummary]]:
    if not user.institucion_id:
        raise ApplicationError(
            "Tu usuario no está asociado a una institución", status_code=400
        )
    invitations = await event_controller.list_invitations_for_institution(
        session, institucion_id=user.institucion_id
    )
    return ResponseEnvelope(data=invitations)


@router.get(
    "/{event_id}/institutions",
    response_model=ResponseEnvelope[list[InvitationSummary]],
)
async def list_event_institutions(
    event_id: int,
    session: AsyncSession = Depends(get_session),
    user: UserBase = Depends(
        require_roles(
            "Administrador",
            "Representante de comisión",
            "Representante educativo",
        )
    ),
) -> ResponseEnvelope[list[InvitationSummary]]:
    invitations = await event_controller.list_invitations_for_event(
        session, event_id=event_id, actor=user
    )
    return ResponseEnvelope(data=invitations)


@router.post(
    "/{event_id}/institutions",
    response_model=ResponseEnvelope[InvitationSummary],
    status_code=status.HTTP_201_CREATED,
)
async def add_event_institution(
    event_id: int,
    payload: EventInstitutionCreate,
    session: AsyncSession = Depends(get_session),
    user: UserBase = Depends(
        require_roles("Administrador", "Representante de comisión")
    ),
) -> ResponseEnvelope[InvitationSummary]:
    summary = await event_controller.add_event_institution(
        session, event_id=event_id, payload=payload, actor=user
    )
    return ResponseEnvelope(data=summary)


@router.delete(
    "/{event_id}/institutions/{institution_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_event_institution(
    event_id: int,
    institution_id: int,
    session: AsyncSession = Depends(get_session),
    user: UserBase = Depends(
        require_roles("Administrador", "Representante de comisión")
    ),
) -> Response:
    await event_controller.remove_event_institution(
        session,
        event_id=event_id,
        institucion_id=institution_id,
        actor=user,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{event_id}/institutions/{institution_id}/notify",
    response_model=ResponseEnvelope[InvitationNotificationResult],
)
async def notify_event_institution(
    event_id: int,
    institution_id: int,
    payload: InvitationNotificationPayload,
    session: AsyncSession = Depends(get_session),
    user: UserBase = Depends(
        require_roles("Administrador", "Representante de comisión")
    ),
) -> ResponseEnvelope[InvitationNotificationResult]:
    result = await event_controller.notify_event_institution(
        session,
        event_id=event_id,
        institucion_id=institution_id,
        payload=payload,
        actor=user,
    )
    return ResponseEnvelope(data=result)


@router.post(
    "/{event_id}/invitations/accept",
    response_model=ResponseEnvelope[InvitationSummary],
)
async def accept_invitation(
    event_id: int,
    session: AsyncSession = Depends(get_session),
    user: UserBase = Depends(require_roles("Representante educativo")),
) -> ResponseEnvelope[InvitationSummary]:
    if not user.institucion_id:
        raise ApplicationError(
            "Tu usuario no está asociado a una institución", status_code=400
        )
    invitation = await event_controller.accept_event_invitation(
        session,
        event_id=event_id,
        institucion_id=user.institucion_id,
        actor=user,
    )
    return ResponseEnvelope(data=invitation)


@router.post(
    "/{event_id}/invitations/reject",
    response_model=ResponseEnvelope[InvitationSummary],
)
async def reject_invitation(
    event_id: int,
    session: AsyncSession = Depends(get_session),
    user: UserBase = Depends(require_roles("Representante educativo")),
) -> ResponseEnvelope[InvitationSummary]:
    if not user.institucion_id:
        raise ApplicationError(
            "Tu usuario no está asociado a una institución", status_code=400
        )
    invitation = await event_controller.reject_event_invitation(
        session,
        event_id=event_id,
        institucion_id=user.institucion_id,
        actor=user,
    )
    return ResponseEnvelope(data=invitation)


@router.get(
    "/{event_id}/registrations/me",
    response_model=ResponseEnvelope[RegistrationSnapshot],
)
async def get_my_registration(
    event_id: int,
    session: AsyncSession = Depends(get_session),
    user: UserBase = Depends(require_roles("Representante educativo")),
) -> ResponseEnvelope[RegistrationSnapshot]:
    if not user.institucion_id:
        raise ApplicationError(
            "Tu usuario no está asociado a una institución", status_code=400
        )
    registration = await event_controller.get_institution_registration(
        session, event_id=event_id, institucion_id=user.institucion_id
    )
    return ResponseEnvelope(data=registration)


@router.get(
    "/{event_id}/institutions/{institution_id}/registration",
    response_model=ResponseEnvelope[RegistrationSnapshot],
)
async def get_institution_registration_admin(
    event_id: int,
    institution_id: int,
    session: AsyncSession = Depends(get_session),
    user: UserBase = Depends(
        require_roles("Administrador", "Representante de comisión")
    ),
) -> ResponseEnvelope[RegistrationSnapshot]:
    registration = await event_controller.get_institution_registration(
        session, event_id=event_id, institucion_id=institution_id
    )
    return ResponseEnvelope(data=registration)


@router.put(
    "/{event_id}/registrations/me",
    response_model=ResponseEnvelope[RegistrationSnapshot],
)
async def update_my_registration(
    event_id: int,
    payload: RegistrationPayload,
    session: AsyncSession = Depends(get_session),
    user: UserBase = Depends(require_roles("Representante educativo")),
) -> ResponseEnvelope[RegistrationSnapshot]:
    if not user.institucion_id:
        raise ApplicationError(
            "Tu usuario no está asociado a una institución", status_code=400
        )
    registration = await event_controller.save_institution_registration(
        session,
        event_id=event_id,
        institucion_id=user.institucion_id,
        payload=payload,
        actor=user,
    )
    return ResponseEnvelope(data=registration)


@router.post(
    "/{event_id}/registrations/me/students/{student_id}/documents",
    response_model=ResponseEnvelope[RegistrationStudentDocument],
)
async def upload_my_student_document(
    event_id: int,
    student_id: int,
    tipo_documento: str = Form(...),
    archivo: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
    user: UserBase = Depends(require_roles("Representante educativo")),
) -> ResponseEnvelope[RegistrationStudentDocument]:
    if not user.institucion_id:
        raise ApplicationError(
            "Tu usuario no está asociado a una institución", status_code=400
        )
    document = await event_controller.upload_student_document(
        session,
        event_id=event_id,
        institucion_id=user.institucion_id,
        estudiante_id=student_id,
        tipo_documento=tipo_documento,
        archivo=archivo,
        actor=user,
    )
    return ResponseEnvelope(data=document)


@router.post(
    "/{event_id}/registrations/me/documents/batch",
    response_model=ResponseEnvelope[StudentDocumentBatchResult],
)
async def upload_my_student_documents_batch(
    event_id: int,
    metadata: str = Form(...),
    archivos: list[UploadFile] = File(...),
    session: AsyncSession = Depends(get_session),
    user: UserBase = Depends(require_roles("Representante educativo")),
) -> ResponseEnvelope[StudentDocumentBatchResult]:
    if not user.institucion_id:
        raise ApplicationError(
            "Tu usuario no está asociado a una institución", status_code=400
        )

    if metadata is None:
        raise ApplicationError(
            "Falta la información de los documentos a cargar", status_code=400
        )

    try:
        raw_payload = json.loads(metadata)
    except (TypeError, JSONDecodeError) as exc:  # noqa: PERF203
        raise ApplicationError(
            "No se pudo procesar la información de los documentos",
            status_code=400,
        ) from exc

    try:
        payload = StudentDocumentBatchUpload.model_validate(raw_payload)
    except ValidationError as exc:  # noqa: PERF203
        raise ApplicationError(
            "Los datos de los documentos no son válidos", status_code=400
        ) from exc

    result = await event_controller.upload_student_documents_batch(
        session,
        event_id=event_id,
        institucion_id=user.institucion_id,
        payload=payload,
        archivos=archivos,
        actor=user,
    )
    return ResponseEnvelope(data=result)


@router.put(
    "/{event_id}/institutions/{institution_id}/documents/review",
    response_model=ResponseEnvelope[RegistrationSnapshot],
)
async def review_institution_documents(
    event_id: int,
    institution_id: int,
    payload: StudentDocumentReviewPayload,
    session: AsyncSession = Depends(get_session),
    user: UserBase = Depends(
        require_roles("Administrador", "Representante de comisión")
    ),
) -> ResponseEnvelope[RegistrationSnapshot]:
    snapshot = await event_controller.review_institution_documents(
        session,
        event_id=event_id,
        institucion_id=institution_id,
        payload=payload,
        actor=user,
    )
    return ResponseEnvelope(data=snapshot)


@router.put(
    "/{event_id}/institutions/{institution_id}/registration/extension",
    response_model=ResponseEnvelope[RegistrationSnapshot],
)
async def extend_institution_registration(
    event_id: int,
    institution_id: int,
    payload: RegistrationExtensionPayload,
    session: AsyncSession = Depends(get_session),
    user: UserBase = Depends(
        require_roles("Administrador", "Representante de comisión")
    ),
) -> ResponseEnvelope[RegistrationSnapshot]:
    snapshot = await event_controller.extend_institution_registration(
        session,
        event_id=event_id,
        institucion_id=institution_id,
        payload=payload,
        actor=user,
    )
    return ResponseEnvelope(data=snapshot)


@router.post(
    "/{event_id}/institutions/{institution_id}/audit",
    response_model=ResponseEnvelope[InvitationSummary],
)
async def audit_institution(
    event_id: int,
    institution_id: int,
    payload: AuditDecisionPayload,
    session: AsyncSession = Depends(get_session),
    user: UserBase = Depends(
        require_roles("Administrador", "Representante de comisión")
    ),
) -> ResponseEnvelope[InvitationSummary]:
    summary = await event_controller.audit_institution_registration(
        session,
        event_id=event_id,
        institucion_id=institution_id,
        payload=payload,
        actor=user,
    )
    return ResponseEnvelope(data=summary)


@router.post(
    "/{event_id}/institutions/audit/batch",
    response_model=ResponseEnvelope[list[InvitationSummary]],
)
async def audit_institutions_batch(
    event_id: int,
    payload: AuditDecisionBatchPayload,
    session: AsyncSession = Depends(get_session),
    user: UserBase = Depends(
        require_roles("Administrador", "Representante de comisión")
    ),
) -> ResponseEnvelope[list[InvitationSummary]]:
    summaries = await event_controller.audit_institutions_registration_batch(
        session,
        event_id=event_id,
        payload=payload,
        actor=user,
    )
    return ResponseEnvelope(data=summaries)


@router.get(
    "/{event_id}/schedule",
    response_model=ResponseEnvelope[list[FixtureMatch]],
)
async def get_event_schedule(
    event_id: int,
    session: AsyncSession = Depends(get_session),
    user: UserBase = Depends(
        require_roles(
            "Administrador",
            "Representante de comisión",
            "Representante educativo",
        )
    ),
) -> ResponseEnvelope[list[FixtureMatch]]:
    matches, meta = await event_controller.get_event_schedule(
        session, event_id=event_id, actor=user
    )
    meta_envelope = Meta(extra=meta) if meta else None
    return ResponseEnvelope(data=matches, meta=meta_envelope)


@router.get(
    "/{event_id}/standings",
    response_model=ResponseEnvelope[list[StandingTable]],
)
async def get_event_standings(
    event_id: int,
    session: AsyncSession = Depends(get_session),
    user: UserBase = Depends(
        require_roles(
            "Administrador",
            "Representante de comisión",
            "Representante educativo",
        )
    ),
) -> ResponseEnvelope[list[StandingTable]]:
    tables = await event_controller.get_event_standings(
        session, event_id=event_id, actor=user
    )
    return ResponseEnvelope(data=tables)


@router.post(
    "/{event_id}/schedule",
    response_model=ResponseEnvelope[list[FixtureMatch]],
)
async def generate_event_schedule(
    event_id: int,
    payload: ScheduleRequest | None = None,
    session: AsyncSession = Depends(get_session),
    user: UserBase = Depends(
        require_roles("Administrador", "Representante de comisión")
    ),
) -> ResponseEnvelope[list[FixtureMatch]]:
    matches, meta = await event_controller.generate_event_schedule(
        session,
        event_id=event_id,
        payload=payload,
        actor=user,
    )
    meta_envelope = Meta(extra=meta) if meta else None
    return ResponseEnvelope(data=matches, meta=meta_envelope)


@router.delete(
    "/{event_id}/schedule",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_event_schedule(
    event_id: int,
    session: AsyncSession = Depends(get_session),
    user: UserBase = Depends(
        require_roles("Administrador", "Representante de comisión")
    ),
) -> Response:
    await event_controller.delete_event_schedule(
        session,
        event_id=event_id,
        actor=user,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/{event_id}/fixture",
    response_model=ResponseEnvelope[list[FixtureMatch]],
)
async def get_event_fixture(
    event_id: int,
    session: AsyncSession = Depends(get_session),
    user: UserBase = Depends(
        require_roles(
            "Administrador",
            "Representante de comisión",
            "Representante educativo",
        )
    ),
) -> ResponseEnvelope[list[FixtureMatch]]:
    matches = await event_controller.list_event_fixture(
        session, event_id=event_id, actor=user
    )
    return ResponseEnvelope(data=matches)


@router.put(
    "/{event_id}/fixture",
    response_model=ResponseEnvelope[list[FixtureMatch]],
)
async def update_event_fixture(
    event_id: int,
    payload: FixturePayload,
    session: AsyncSession = Depends(get_session),
    user: UserBase = Depends(
        require_roles("Administrador", "Representante de comisión")
    ),
) -> ResponseEnvelope[list[FixtureMatch]]:
    matches = await event_controller.update_event_fixture(
        session,
        event_id=event_id,
        payload=payload,
        actor=user,
    )
    return ResponseEnvelope(data=matches)


@router.post(
    "/{event_id}/fixture/{match_id}/result",
    response_model=ResponseEnvelope[FixtureMatch],
)
async def register_match_result(
    event_id: int,
    match_id: int,
    payload: MatchResultPayload,
    session: AsyncSession = Depends(get_session),
    user: UserBase = Depends(
        require_roles("Administrador", "Representante de comisión")
    ),
) -> ResponseEnvelope[FixtureMatch]:
    match, meta = await event_controller.register_match_result(
        session,
        event_id=event_id,
        match_id=match_id,
        payload=payload,
        actor=user,
    )
    meta_envelope = Meta(extra=meta) if meta else None
    return ResponseEnvelope(data=match, meta=meta_envelope)


@router.get(
    "/{event_id}/fixture/{match_id}/players",
    response_model=ResponseEnvelope[MatchResultConfig],
)
async def get_match_players_config(
    event_id: int,
    match_id: int,
    session: AsyncSession = Depends(get_session),
    user: UserBase = Depends(
        require_roles("Administrador", "Representante de comisión")
    ),
) -> ResponseEnvelope[MatchResultConfig]:
    config = await result_service.get_match_players(session, match_id=match_id)
    if not config:
         raise ApplicationError("Partido no encontrado", status_code=404)
    return ResponseEnvelope(data=config)


@router.post(
    "/{event_id}/fixture/{match_id}/detailed_result",
    response_model=ResponseEnvelope[FixtureMatch],
)
async def register_detailed_match_result(
    event_id: int,
    match_id: int,
    payload: RegisterResultRequest,
    session: AsyncSession = Depends(get_session),
    user: UserBase = Depends(
        require_roles("Administrador", "Representante de comisión")
    ),
) -> ResponseEnvelope[FixtureMatch]:
    match = await result_service.register_result(
        session,
        match_id=match_id,
        player_results=payload.results,
        publish_news=payload.publish_news,
        criterio=payload.criterio,
    )
    return ResponseEnvelope(data=FixtureMatch.model_validate(match, from_attributes=True))


@router.post(
    "/{event_id}/fixture/{match_id}/publish",
    response_model=ResponseEnvelope[FixtureMatch],
)
async def publish_match_news(
    event_id: int,
    match_id: int,
    session: AsyncSession = Depends(get_session),
    user: UserBase = Depends(
        require_roles("Administrador", "Representante de comisión")
    ),
) -> ResponseEnvelope[FixtureMatch]:
    match, meta = await event_controller.publish_match_news(
        session,
        event_id=event_id,
        match_id=match_id,
        actor=user,
    )
    meta_envelope = Meta(extra=meta) if meta else None
    return ResponseEnvelope(data=match, meta=meta_envelope)

@router.put("/{event_id}", response_model=ResponseEnvelope[Event])
async def update_event(
    event_id: int,
    request: Request,
    session: AsyncSession = Depends(get_session),
    user: UserBase = Depends(require_roles("Administrador", "Representante de comisión")),
) -> ResponseEnvelope[Event]:
    payload, planning_document, cover_image = await _parse_event_payload(request, EventUpdate)
    event = await event_controller.update_event(
        session,
        event_id=event_id,
        payload=payload,
        planning_document=planning_document,
        cover_image=cover_image,
        actor=user,
    )
    return ResponseEnvelope(data=event)


@router.patch(
    "/{event_id}/timeline",
    response_model=ResponseEnvelope[Event],
)
async def update_event_timeline(
    event_id: int,
    payload: EventTimelineUpdate,
    session: AsyncSession = Depends(get_session),
    user: UserBase = Depends(require_roles("Administrador", "Representante de comisión")),
) -> ResponseEnvelope[Event]:
    event = await event_controller.update_event_timeline(
        session, event_id=event_id, payload=payload, actor=user
    )
    return ResponseEnvelope(data=event)


@router.get("/{event_id}/stage", response_model=ResponseEnvelope[str])
async def get_event_stage(
    event_id: int,
    fecha: date | None = Query(None),
    session: AsyncSession = Depends(get_session),
    user: UserBase = Depends(
        require_roles("Administrador", "Representante de comisión", "Representante educativo")
    ),
) -> ResponseEnvelope[str]:
    stage = await event_controller.get_event_current_stage(
        session, event_id=event_id, fecha_hoy=fecha
    )
    return ResponseEnvelope(data=stage)


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(
    event_id: int,
    session: AsyncSession = Depends(get_session),
    user: UserBase = Depends(require_roles("Administrador", "Representante de comisión")),
) -> Response:
    await event_controller.delete_event(session, event_id=event_id, actor=user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
