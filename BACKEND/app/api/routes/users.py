from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request, status
from fastapi.datastructures import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_roles
from app.controllers import user_controller
from app.core.database import get_session
from app.schemas.common import Meta, ResponseEnvelope
from app.schemas.user import UserBase, UserCreate, UserProfileUpdate, UserUpdate
from app.services import file_service

router = APIRouter(prefix="/users", tags=["users"])


def _to_bool(value: str | None) -> bool:
    if value is None:
        return False
    return value.lower() in {"1", "true", "on", "yes"}


async def _parse_user_payload(
    request: Request,
    *,
    is_update: bool,
) -> tuple[dict, UploadFile | None, bool]:
    content_type = request.headers.get("content-type", "")
    if content_type.startswith("multipart/form-data"):
        form = await request.form()
        raw_file = form.get("avatar")
        if raw_file is not None and getattr(raw_file, "filename", None):
            avatar = raw_file
        else:
            avatar = None
        remove_avatar = _to_bool(form.get("remove_avatar")) if "remove_avatar" in form else False

        data: dict[str, object] = {}

        for field in ["nombre_completo", "email", "telefono", "password", "tipo_sangre"]:
            if field in form:
                value = form.get(field)
                data[field] = value.strip() if isinstance(value, str) else value

        if "rol_id" in form:
            raw_role = form.get("rol_id")
            data["rol_id"] = int(raw_role) if str(raw_role).strip() else None
        if "institucion_id" in form:
            raw_institution = form.get("institucion_id")
            data["institucion_id"] = int(raw_institution) if str(raw_institution).strip() else None
        if "deporte_id" in form:
            raw_sport = form.get("deporte_id")
            data["deporte_id"] = int(raw_sport) if str(raw_sport).strip() else None

        if "activo" in form:
            data["activo"] = _to_bool(form.get("activo"))

        if not is_update:
            data.setdefault("send_welcome", _to_bool(form.get("send_welcome")))
        elif "send_welcome" in form:
            data["send_welcome"] = _to_bool(form.get("send_welcome"))

        if remove_avatar:
            data["remove_avatar"] = True

        for key, value in list(data.items()):
            if isinstance(value, str):
                data[key] = value or None

        return data, avatar, remove_avatar

    payload = await request.json()
    remove_avatar = False
    if isinstance(payload, dict):
        remove_avatar = bool(payload.get("remove_avatar"))
    payload = payload if isinstance(payload, dict) else {}
    payload = dict(payload)
    if "rol_id" in payload:
        raw_role = payload.get("rol_id")
        payload["rol_id"] = int(raw_role) if raw_role not in (None, "") else None
    if "institucion_id" in payload:
        raw_institution = payload.get("institucion_id")
        payload["institucion_id"] = int(raw_institution) if raw_institution not in (None, "") else None
    if "deporte_id" in payload:
        raw_sport = payload.get("deporte_id")
        payload["deporte_id"] = int(raw_sport) if raw_sport not in (None, "") else None
    return payload, None, remove_avatar


async def _parse_profile_payload(request: Request) -> tuple[dict, UploadFile | None, bool]:
    content_type = request.headers.get("content-type", "")
    if content_type.startswith("multipart/form-data"):
        form = await request.form()
        raw_file = form.get("avatar")
        if raw_file is not None and getattr(raw_file, "filename", None):
            avatar = raw_file
        else:
            avatar = None        
        remove_avatar = _to_bool(form.get("remove_avatar")) if "remove_avatar" in form else False

        data: dict[str, object] = {}
        for field in ["nombre_completo", "telefono", "password_actual", "password_nueva", "tipo_sangre"]:
            if field in form:
                value = form.get(field)
                data[field] = value.strip() if isinstance(value, str) else value

        if remove_avatar:
            data["remove_avatar"] = True

        for key, value in list(data.items()):
            if isinstance(value, str):
                data[key] = value or None

        return data, avatar, remove_avatar

    try:
        payload = await request.json()
    except Exception:
        payload = {}
    remove_avatar = False
    if isinstance(payload, dict):
        remove_avatar = bool(payload.get("remove_avatar"))
    normalized = dict(payload or {})
    if "rol_id" in normalized:
        raw_role = normalized.get("rol_id")
        normalized["rol_id"] = int(raw_role) if raw_role not in (None, "") else None
    if "institucion_id" in normalized:
        raw_institution = normalized.get("institucion_id")
        normalized["institucion_id"] = (
            int(raw_institution) if raw_institution not in (None, "") else None
        )
    return normalized, None, remove_avatar


@router.get("/", response_model=ResponseEnvelope[list[UserBase]])
async def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    search: str | None = Query(None),
    include_deleted: bool = Query(True),
    roles: str | None = Query(None),
    institucion_id: int | None = Query(None),
    unassigned_only: bool = Query(False),
    session: AsyncSession = Depends(get_session),
    _: UserBase = Depends(require_roles("Administrador", "Representante de comisión")),
) -> ResponseEnvelope[list[UserBase]]:
    role_list = [item.strip() for item in (roles.split(",") if roles else []) if item.strip()]
    users, total = await user_controller.list_users(
        session,
        page=page,
        page_size=page_size,
        search=search,
        include_deleted=include_deleted,
        roles=role_list or None,
        institucion_id=institucion_id,
        unassigned_only=unassigned_only,
    )
    meta = Meta(total=total, page=page, page_size=page_size)
    return ResponseEnvelope(data=users, meta=meta)



@router.post("/", response_model=ResponseEnvelope[UserBase], status_code=status.HTTP_201_CREATED)
async def create_user(
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: UserBase = Depends(require_roles("Administrador", "Representante de comisión")),
) -> ResponseEnvelope[UserBase]:
    payload_data, avatar, _ = await _parse_user_payload(request, is_update=False)
    if avatar:
        payload_data["avatar_url"] = await file_service.save_image(avatar, folder="users")
    payload = UserCreate.model_validate(payload_data)
    user = await user_controller.create_user(session, payload, actor=current_user)
    return ResponseEnvelope(data=user)


@router.put("/{user_id}", response_model=ResponseEnvelope[UserBase])
async def update_user(
    user_id: int,
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: UserBase = Depends(require_roles("Administrador", "Representante de comisión")),
) -> ResponseEnvelope[UserBase]:
    payload_data, avatar, remove_flag = await _parse_user_payload(request, is_update=True)
    if avatar:
        payload_data["avatar_url"] = await file_service.save_image(avatar, folder="users")
    if remove_flag:
        payload_data["remove_avatar"] = True
    payload = UserUpdate.model_validate(payload_data)
    user = await user_controller.update_user(
        session, user_id, payload, actor=current_user
    )
    return ResponseEnvelope(data=user)


@router.delete("/{user_id}", response_model=ResponseEnvelope[dict])
async def delete_user(
    user_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: UserBase = Depends(require_roles("Administrador", "Representante de comisión")),
) -> ResponseEnvelope[dict]:
    await user_controller.delete_user(session, user_id, actor=current_user)
    return ResponseEnvelope(data={"message": "Usuario eliminado"})


@router.post("/{user_id}/restore", response_model=ResponseEnvelope[UserBase])
async def restore_user(
    user_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: UserBase = Depends(require_roles("Administrador", "Representante de comisión")),
) -> ResponseEnvelope[UserBase]:
    user = await user_controller.restore_user(session, user_id, actor=current_user)
    return ResponseEnvelope(data=user)


@router.delete("/{user_id}/force", response_model=ResponseEnvelope[dict])
async def force_delete_user(
    user_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: UserBase = Depends(require_roles("Administrador", "Representante de comisión")),
) -> ResponseEnvelope[dict]:
    await user_controller.delete_user_permanently(
        session, user_id, actor=current_user
    )
    return ResponseEnvelope(data={"message": "Usuario eliminado permanentemente"})


@router.post("/{user_id}/send-recovery", response_model=ResponseEnvelope[dict])
async def send_account_recovery(
    user_id: int,
    session: AsyncSession = Depends(get_session),
    _: UserBase = Depends(require_roles("Administrador", "Representante de comisión")),
) -> ResponseEnvelope[dict]:
    await user_controller.send_account_recovery(session, user_id)
    return ResponseEnvelope(data={"message": "Se envió la recuperación de cuenta"})


@router.put("/me", response_model=ResponseEnvelope[UserBase])
async def update_profile(
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: UserBase = Depends(get_current_user),
) -> ResponseEnvelope[UserBase]:
    payload_data, avatar, remove_flag = await _parse_profile_payload(request)
    if avatar:
        payload_data["avatar_url"] = await file_service.save_image(avatar, folder="users")
    if remove_flag:
        payload_data["remove_avatar"] = True
    payload = UserProfileUpdate.model_validate(payload_data)
    user = await user_controller.update_profile(session, current_user.id, payload)
    return ResponseEnvelope(data=user)
