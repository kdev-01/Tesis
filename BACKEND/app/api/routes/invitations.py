from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_roles
from app.core.database import get_session
from app.schemas.common import ResponseEnvelope
from app.schemas.invitation import (
    InvitationAcceptRequest,
    InvitationCreate,
    InvitationPublic,
    InvitationSupportData,
)
from app.schemas.user import UserBase
from app.services.invitation_service import invitation_service

router = APIRouter(prefix="/invitations", tags=["invitations"])


@router.post("/", response_model=ResponseEnvelope[InvitationPublic], status_code=status.HTTP_201_CREATED)
async def create_invitation(
    payload: InvitationCreate,
    session: AsyncSession = Depends(get_session),
    current_user: UserBase = Depends(require_roles("Administrador", "Representante de comisión")),
) -> ResponseEnvelope[InvitationPublic]:
    invitation = await invitation_service.create_invitation(
        session,
        payload,
        inviter_name=current_user.nombre_completo,
    )
    return ResponseEnvelope(data=invitation)


@router.get("/", response_model=ResponseEnvelope[list[InvitationPublic]])
async def list_pending_invitations(
    session: AsyncSession = Depends(get_session),
    _: UserBase = Depends(require_roles("Administrador", "Representante de comisión")),
) -> ResponseEnvelope[list[InvitationPublic]]:
    invitations = await invitation_service.list_pending(session)
    return ResponseEnvelope(data=invitations)


@router.delete("/{token}", response_model=ResponseEnvelope[dict])
async def cancel_invitation(
    token: str,
    session: AsyncSession = Depends(get_session),
    _: UserBase = Depends(require_roles("Administrador", "Representante de comisión")),
) -> ResponseEnvelope[dict]:
    await invitation_service.cancel_invitation(session, token)
    return ResponseEnvelope(data={"message": "Invitación cancelada"})


@router.get("/support-data", response_model=ResponseEnvelope[InvitationSupportData])
async def list_invitation_support_data(
    session: AsyncSession = Depends(get_session),
) -> ResponseEnvelope[InvitationSupportData]:
    support_data = await invitation_service.get_support_data(session)
    return ResponseEnvelope(data=support_data)


@router.get("/{token}", response_model=ResponseEnvelope[InvitationPublic])
async def get_invitation(token: str, session: AsyncSession = Depends(get_session)) -> ResponseEnvelope[InvitationPublic]:
    invitation = await invitation_service.get_invitation(session, token)
    return ResponseEnvelope(data=invitation)


@router.post("/{token}/accept", response_model=ResponseEnvelope[InvitationPublic])
async def accept_invitation(
    token: str,
    payload: InvitationAcceptRequest,
    session: AsyncSession = Depends(get_session),
) -> ResponseEnvelope[InvitationPublic]:
    invitation = await invitation_service.accept_invitation(session, token, payload)
    return ResponseEnvelope(data=invitation)
