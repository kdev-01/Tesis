from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request, status
from fastapi.datastructures import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_roles
from app.controllers import student_controller
from app.core.database import get_session
from app.schemas.common import Meta, ResponseEnvelope
from app.schemas.student import Student, StudentCreate, StudentUpdate
from app.schemas.user import UserBase
from app.services import file_service

router = APIRouter(prefix="/students", tags=["students"])


def _to_bool(value: str | None) -> bool:
    if value is None:
        return False
    return value.lower() in {"1", "true", "on", "yes"}


async def _parse_student_payload(
    request: Request,
    *,
    is_update: bool,
) -> tuple[dict, UploadFile | None, bool]:
    content_type = request.headers.get("content-type", "")
    if content_type.startswith("multipart/form-data"):
        form = await request.form()
        raw_file = form.get("foto")

        # ✅ CAMBIO AQUÍ: no usar isinstance, solo chequear filename
        if raw_file is not None and getattr(raw_file, "filename", None):
            foto = raw_file
        else:
            foto = None

        remove_foto = _to_bool(form.get("remove_foto")) if "remove_foto" in form else False

        data: dict[str, object] = {}
        for field in [
            "institucion_id",
            "nombres",
            "apellidos",
            "documento_identidad",
            "fecha_nacimiento",
            "genero",
        ]:
            if field in form:
                value = form.get(field)
                if isinstance(value, str):
                    data[field] = value.strip()
                else:
                    data[field] = value

        if "activo" in form:
            data["activo"] = _to_bool(form.get("activo"))
        elif not is_update:
            data["activo"] = True

        if remove_foto:
            data["remove_foto"] = True

        for key, value in list(data.items()):
            if isinstance(value, str):
                data[key] = value or None

        return data, foto, remove_foto

    payload = await request.json()
    remove_foto = False
    if isinstance(payload, dict):
        remove_foto = bool(payload.get("remove_foto"))
    return payload, None, remove_foto

@router.get("/", response_model=ResponseEnvelope[list[Student]])
async def list_students(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    search: str | None = Query(None),
    institucion_id: int | None = Query(None),
    unassigned_only: bool = Query(False),
    include_deleted: bool = Query(False),
    session: AsyncSession = Depends(get_session),
    current_user: UserBase = Depends(
        require_roles(
            "Administrador", "Representante de comisión", "Representante educativo"
        )
    ),
) -> ResponseEnvelope[list[Student]]:
    students, total = await student_controller.list_students(
        session,
        page=page,
        page_size=page_size,
        search=search,
        institucion_id=institucion_id,
        unassigned_only=unassigned_only,
        include_deleted=include_deleted,
        actor=current_user,
    )
    meta = Meta(total=total, page=page, page_size=page_size)
    return ResponseEnvelope(data=students, meta=meta)


@router.post("/", response_model=ResponseEnvelope[Student], status_code=status.HTTP_201_CREATED)
async def create_student(
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: UserBase = Depends(
        require_roles(
            "Administrador", "Representante de comisión", "Representante educativo"
        )
    ),
) -> ResponseEnvelope[Student]:
    payload_data, foto, _ = await _parse_student_payload(request, is_update=False)
    if foto:
        payload_data["foto_url"] = await file_service.save_image(foto, folder="students")
    payload = StudentCreate.model_validate(payload_data)
    student = await student_controller.create_student(session, payload, actor=current_user)
    return ResponseEnvelope(data=student)


@router.put("/{student_id}", response_model=ResponseEnvelope[Student])
async def update_student(
    student_id: int,
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: UserBase = Depends(
        require_roles(
            "Administrador", "Representante de comisión", "Representante educativo"
        )
    ),
) -> ResponseEnvelope[Student]:
    payload_data, foto, remove_flag = await _parse_student_payload(request, is_update=True)
    if foto:
        payload_data["foto_url"] = await file_service.save_image(foto, folder="students")
    if remove_flag:
        payload_data["remove_foto"] = True
    payload = StudentUpdate.model_validate(payload_data)
    student = await student_controller.update_student(
        session, student_id, payload, actor=current_user
    )
    return ResponseEnvelope(data=student)


@router.delete("/{student_id}", response_model=ResponseEnvelope[dict])
async def delete_student(
    student_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: UserBase = Depends(
        require_roles(
            "Administrador", "Representante de comisión", "Representante educativo"
        )
    ),
) -> ResponseEnvelope[dict]:
    await student_controller.delete_student(session, student_id, actor=current_user)
    return ResponseEnvelope(data={"message": "Estudiante eliminado"})


@router.post("/{student_id}/restore", response_model=ResponseEnvelope[Student])
async def restore_student(
    student_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: UserBase = Depends(
        require_roles(
            "Administrador", "Representante de comisión", "Representante educativo"
        )
    ),
) -> ResponseEnvelope[Student]:
    student = await student_controller.restore_student(session, student_id, actor=current_user)
    return ResponseEnvelope(data=student)


@router.delete("/{student_id}/force", response_model=ResponseEnvelope[dict])
async def force_delete_student(
    student_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: UserBase = Depends(
        require_roles(
            "Administrador", "Representante de comisión", "Representante educativo"
        )
    ),
) -> ResponseEnvelope[dict]:
    await student_controller.delete_student_permanently(session, student_id, actor=current_user)
    return ResponseEnvelope(data={"message": "Estudiante eliminado permanentemente"})
