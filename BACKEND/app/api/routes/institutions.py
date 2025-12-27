from __future__ import annotations

import json

from fastapi import APIRouter, Depends, Query, Request, status
from fastapi.datastructures import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_roles
from app.controllers import institution_controller
from app.core.database import get_session
from app.schemas.common import Meta, ResponseEnvelope
from app.schemas.institution import (
    Institution,
    InstitutionCreate,
    InstitutionDisaffiliation,
    InstitutionReaffiliation,
    InstitutionSanction,
    InstitutionSanctionLift,
    InstitutionUpdate,
)
from app.schemas.user import UserBase
from app.services import file_service

router = APIRouter(prefix="/institutions", tags=["institutions"])


def _to_bool(value: str | None) -> bool:
    if value is None:
        return False
    return value.lower() in {"1", "true", "on", "yes"}


async def _parse_institution_payload(
    request: Request,
) -> tuple[dict, UploadFile | None, bool]:
    content_type = request.headers.get("content-type", "")
    if content_type.startswith("multipart/form-data"):
        form = await request.form()
        raw_file = form.get("portada")

        # ✅ CAMBIO AQUÍ
        if raw_file is not None and getattr(raw_file, "filename", None):
            portada = raw_file
        else:
            portada = None

        remove_portada = _to_bool(form.get("remove_portada")) if "remove_portada" in form else False

        data: dict[str, object] = {}
        for field in [
            "nombre",
            "descripcion",
            "direccion",
            "ciudad",
            "email",
            "telefono",
            "estado",
        ]:
            if field in form:
                value = form.get(field)
                data[field] = value.strip() if isinstance(value, str) else value

        if "portada_url" in form and not portada:
            url_value = form.get("portada_url")
            data["portada_url"] = (
                url_value.strip() if isinstance(url_value, str) and url_value.strip() else None
            )

        if remove_portada:
            data["remove_portada"] = True

        for key, value in list(data.items()):
            if isinstance(value, str) and not value:
                data[key] = None

        return data, portada, remove_portada

    payload = await request.json()
    return payload, None, bool(payload.get("remove_portada")) if isinstance(payload, dict) else False

@router.get("/", response_model=ResponseEnvelope[list[Institution]])
async def list_institutions(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    search: str | None = Query(None),
    include_deleted: bool = Query(False),
    session: AsyncSession = Depends(get_session),
    current_user: UserBase = Depends(
        require_roles("Administrador", "Representante de comisión", "Representante educativo")
    ),
) -> ResponseEnvelope[list[Institution]]:
    institutions, total = await institution_controller.list_institutions(
        session,
        page=page,
        page_size=page_size,
        search=search,
        include_deleted=include_deleted,
        actor=current_user,
    )
    meta = Meta(total=total, page=page, page_size=page_size)
    return ResponseEnvelope(data=institutions, meta=meta)


@router.get("/{institution_id}", response_model=ResponseEnvelope[Institution])
async def get_institution_detail(
    institution_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: UserBase = Depends(
        require_roles("Administrador", "Representante de comisión", "Representante educativo")
    ),
) -> ResponseEnvelope[Institution]:
    institution = await institution_controller.get_institution(
        session, institution_id, actor=current_user
    )
    return ResponseEnvelope(data=institution)


@router.get("/selectable", response_model=ResponseEnvelope[list[Institution]])
async def list_selectable_institutions(
    session: AsyncSession = Depends(get_session),
    _: UserBase = Depends(
        require_roles("Administrador", "Representante de comisión", "Representante educativo")
    ),
) -> ResponseEnvelope[list[Institution]]:
    institutions = await institution_controller.list_selectable_institutions(session)
    return ResponseEnvelope(data=institutions)


@router.post("/", response_model=ResponseEnvelope[Institution], status_code=status.HTTP_201_CREATED)
async def create_institution(
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: UserBase = Depends(
        require_roles("Administrador", "Representante de comisión", "Representante educativo")
    ),
) -> ResponseEnvelope[Institution]:
    payload_data, portada, _ = await _parse_institution_payload(request)
    if portada:
        payload_data["portada_url"] = await file_service.save_image(portada, folder="institutions")
    payload = InstitutionCreate.model_validate(payload_data)
    institution = await institution_controller.create_institution(
        session, payload, actor=current_user
    )
    return ResponseEnvelope(data=institution)


@router.put("/{institution_id}", response_model=ResponseEnvelope[Institution])
async def update_institution(
    institution_id: int,
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: UserBase = Depends(
        require_roles("Administrador", "Representante de comisión", "Representante educativo")
    ),
) -> ResponseEnvelope[Institution]:
    payload_data, portada, remove_flag = await _parse_institution_payload(request)
    if portada:
        payload_data["portada_url"] = await file_service.save_image(portada, folder="institutions")
    if remove_flag:
        payload_data["remove_portada"] = True
    payload = InstitutionUpdate.model_validate(payload_data)
    institution = await institution_controller.update_institution(
        session, institution_id, payload, actor=current_user
    )
    return ResponseEnvelope(data=institution)


@router.delete("/{institution_id}", response_model=ResponseEnvelope[dict])
async def delete_institution(
    institution_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: UserBase = Depends(require_roles("Administrador", "Representante de comisión")),
) -> ResponseEnvelope[dict]:
    await institution_controller.delete_institution(
        session, institution_id, actor=current_user
    )
    return ResponseEnvelope(data={"message": "Institución eliminada"})


@router.post(
    "/{institution_id}/restore",
    response_model=ResponseEnvelope[Institution],
    status_code=status.HTTP_200_OK,
)
async def restore_institution(
    institution_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: UserBase = Depends(require_roles("Administrador", "Representante de comisión")),
) -> ResponseEnvelope[Institution]:
    institution = await institution_controller.restore_institution(
        session, institution_id, actor=current_user
    )
    return ResponseEnvelope(data=institution)


@router.delete(
    "/{institution_id}/force",
    response_model=ResponseEnvelope[dict],
    status_code=status.HTTP_200_OK,
)
async def force_delete_institution(
    institution_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: UserBase = Depends(require_roles("Administrador", "Representante de comisión")),
) -> ResponseEnvelope[dict]:
    await institution_controller.delete_institution_permanently(
        session, institution_id, actor=current_user
    )
    return ResponseEnvelope(data={"message": "Institución eliminada permanentemente"})


@router.post(
    "/{institution_id}/disaffiliate",
    response_model=ResponseEnvelope[Institution],
    status_code=status.HTTP_200_OK,
)
async def disaffiliate_institution(
    institution_id: int,
    request: Request,
    session: AsyncSession = Depends(get_session),
    _: UserBase = Depends(require_roles("Administrador", "Representante de comisión")),
) -> ResponseEnvelope[Institution]:
    payload = InstitutionDisaffiliation.model_validate(await request.json())
    institution = await institution_controller.disaffiliate_institution(session, institution_id, payload)
    return ResponseEnvelope(data=institution)


@router.post(
    "/{institution_id}/reaffiliate",
    response_model=ResponseEnvelope[Institution],
    status_code=status.HTTP_200_OK,
)
async def reaffiliate_institution(
    institution_id: int,
    request: Request,
    session: AsyncSession = Depends(get_session),
    _: UserBase = Depends(require_roles("Administrador", "Representante de comisión")),
) -> ResponseEnvelope[Institution]:
    try:
        payload_data = await request.json()
    except json.JSONDecodeError:
        payload_data = {}
    payload = InstitutionReaffiliation.model_validate(payload_data) if payload_data else None
    institution = await institution_controller.reaffiliate_institution(session, institution_id, payload)
    return ResponseEnvelope(data=institution)


@router.post(
    "/{institution_id}/sanction",
    response_model=ResponseEnvelope[Institution],
    status_code=status.HTTP_200_OK,
)
async def sanction_institution(
    institution_id: int,
    request: Request,
    session: AsyncSession = Depends(get_session),
    _: UserBase = Depends(require_roles("Administrador", "Representante de comisión")),
) -> ResponseEnvelope[Institution]:
    payload = InstitutionSanction.model_validate(await request.json())
    institution = await institution_controller.apply_sanction(session, institution_id, payload)
    return ResponseEnvelope(data=institution)


@router.post(
    "/{institution_id}/sanction/lift",
    response_model=ResponseEnvelope[Institution],
    status_code=status.HTTP_200_OK,
)
async def lift_sanction(
    institution_id: int,
    request: Request,
    session: AsyncSession = Depends(get_session),
    _: UserBase = Depends(require_roles("Administrador", "Representante de comisión")),
) -> ResponseEnvelope[Institution]:
    try:
        payload_data = await request.json()
    except json.JSONDecodeError:
        payload_data = {}
    payload = InstitutionSanctionLift.model_validate(payload_data) if payload_data else None
    institution = await institution_controller.lift_sanction(session, institution_id, payload)
    return ResponseEnvelope(data=institution)
