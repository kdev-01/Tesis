from __future__ import annotations

from datetime import datetime, timedelta, timezone
import secrets

from fastapi import status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import security
from app.core.config import settings
from app.core.exceptions import ApplicationError
from app.repositories import (
    institution_repository,
    invitation_repository,
    role_repository,
    sport_repository,
    user_repository,
)
from app.schemas.invitation import (
    InvitationAcceptRequest,
    InvitationCreate,
    InvitationPublic,
    InvitationSupportData,
    InvitationSupportItem,
)
from app.services.email_service import email_service

INVITATION_TTL_HOURS = 48


class InvitationService:
    @staticmethod
    def _to_public(invitation) -> InvitationPublic:
        return InvitationPublic.model_validate(
            {
                "email": invitation.email,
                "nombre": invitation.nombre,
                "rol_id": invitation.rol_id,
                "rol_nombre": getattr(getattr(invitation, "rol", None), "nombre", None),
                "token": invitation.token,
                "expira_en": invitation.expira_en,
                "aceptado_en": invitation.aceptado_en,
                "creado_en": invitation.creado_en,
            }
        )

    async def create_invitation(
        self,
        session: AsyncSession,
        payload: InvitationCreate,
        *,
        inviter_name: str | None = None,
    ) -> InvitationPublic:
        existing_user = await user_repository.get_user_by_email(
            session, payload.email, include_deleted=True
        )
        if existing_user:
            raise ApplicationError("El correo ya está registrado en el sistema", status_code=status.HTTP_400_BAD_REQUEST)

        role = await role_repository.get_role_by_id(session, payload.rol_id)
        if not role:
            raise ApplicationError("El rol seleccionado no existe", status_code=status.HTTP_404_NOT_FOUND)

        token = secrets.token_urlsafe(32)
        expira_en = datetime.now(timezone.utc) + timedelta(hours=INVITATION_TTL_HOURS)
        invitation = await invitation_repository.create_invitation(
            session,
            email=payload.email,
            nombre=payload.nombre,
            rol_id=payload.rol_id,
            token=token,
            expira_en=expira_en,
        )
        invitation.rol = role
        await session.commit()

        base_url = settings.frontend_base_url.rstrip("/")
        invitation_url = f"{base_url}/registro/{token}"
        await email_service.send_invitation(
            to=payload.email,
            role_name=role.nombre,
            invitation_url=invitation_url,
            inviter=inviter_name,
        )
        return self._to_public(invitation)

    async def get_invitation(self, session: AsyncSession, token: str) -> InvitationPublic:
        invitation = await invitation_repository.get_by_token(session, token)
        if not invitation or invitation.aceptado_en is not None or invitation.expira_en < datetime.now(timezone.utc):
            raise ApplicationError("La invitación no es válida", status_code=status.HTTP_404_NOT_FOUND)
        return self._to_public(invitation)

    async def accept_invitation(self, session: AsyncSession, token: str, payload: InvitationAcceptRequest) -> InvitationPublic:
        invitation = await invitation_repository.get_by_token(session, token)
        if not invitation or invitation.aceptado_en is not None or invitation.expira_en < datetime.now(timezone.utc):
            raise ApplicationError("La invitación no es válida o expiró", status_code=status.HTTP_400_BAD_REQUEST)

        role = await role_repository.get_role_by_id(session, invitation.rol_id)
        if not role:
            raise ApplicationError("El rol asociado a la invitación ya no existe", status_code=status.HTTP_404_NOT_FOUND)

        institution_id: int | None = None
        if payload.institucion_id is not None:
            institution = await institution_repository.get_institution_by_id(
                session, payload.institucion_id
            )
            if not institution or institution.eliminado:
                raise ApplicationError(
                    "La institución seleccionada no existe o no está activa",
                    status_code=status.HTTP_404_NOT_FOUND,
                )
            institution_id = institution.id

        sport_id: int | None = None
        if payload.deporte_id is not None:
            sport = await sport_repository.get_sport_by_id(session, payload.deporte_id)
            if not sport:
                raise ApplicationError(
                    "El deporte seleccionado no está disponible",
                    status_code=status.HTTP_404_NOT_FOUND,
                )
            sport_id = sport.id

        existing = await user_repository.get_user_by_email(
            session, invitation.email, include_deleted=True
        )

        if existing:
            if existing.eliminado:
                await user_repository.restore_user(session, existing)

            updated_roles = {role, *(existing.roles or [])}
            await user_repository.update_user(
                session,
                existing,
                nombre_completo=payload.nombre_completo,
                telefono=payload.telefono,
                telefono_set=True,
                hash_password=security.hash_password(payload.password),
                avatar_url=payload.avatar_url,
                roles=list(updated_roles),
                institucion_id=institution_id,
                institucion_id_set=payload.institucion_id is not None,
                deporte_id=sport_id,
                deporte_id_set=payload.deporte_id is not None,
            )
            user = existing
        else:
            user = await user_repository.create_user(
                session,
                nombre_completo=payload.nombre_completo,
                email=invitation.email,
                telefono=payload.telefono,
                tipo_sangre=None,
                activo=True,
                hash_password=security.hash_password(payload.password),
                avatar_url=payload.avatar_url,
                roles=[role],
                institucion_id=institution_id,
                deporte_id=sport_id,
            )
        await invitation_repository.mark_accepted(session, invitation)
        await session.commit()

        # Opcionalmente podríamos enviar confirmación
        await email_service.send_login_notification(to=user.email, name=user.nombre_completo)

        return self._to_public(invitation)

    async def list_pending(self, session: AsyncSession) -> list[InvitationPublic]:
        invitations = await invitation_repository.list_active(session)
        return [self._to_public(item) for item in invitations]

    async def cancel_invitation(self, session: AsyncSession, token: str) -> None:
        invitation = await invitation_repository.get_by_token(session, token)
        if not invitation:
            return
        await invitation_repository.cancel_invitation(session, invitation)
        await session.commit()

    async def get_support_data(self, session: AsyncSession) -> InvitationSupportData:
        sports = await sport_repository.list_sports(session)
        institutions = await institution_repository.list_selectable_institutions(session)

        return InvitationSupportData(
            deportes=[
                InvitationSupportItem(id=item.id, nombre=item.nombre)
                for item in sports
            ],
            instituciones=[
                InvitationSupportItem(id=item.id, nombre=item.nombre)
                for item in institutions
            ],
        )


invitation_service = InvitationService()
