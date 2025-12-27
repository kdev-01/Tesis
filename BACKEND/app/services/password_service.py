from __future__ import annotations

from datetime import datetime, timedelta, timezone
import secrets

from fastapi import status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import security
from app.core.config import settings
from app.core.exceptions import ApplicationError
from app.repositories import password_reset_repository, user_repository
from app.services.email_service import email_service

RESET_TOKEN_TTL_MINUTES = 30


class PasswordService:
    async def request_reset(self, session: AsyncSession, *, email: str) -> None:
        print("[request_reset] INICIO, email recibido:", email)

        user = await user_repository.get_user_by_email(session, email)
        print("[request_reset] Resultado get_user_by_email:", user)

        if not user:
            print("[request_reset] Usuario NO encontrado, saliendo de la función")
            return

        print("[request_reset] Usuario encontrado -> id:", user.id, "email:", user.email)

        await password_reset_repository.invalidate_existing(session, user.id)
        print("[request_reset] Tokens anteriores invalidados")

        token = secrets.token_urlsafe(32)
        expiracion = datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_TTL_MINUTES)
        print("[request_reset] Token generado:", token)
        print("[request_reset] Expiración:", expiracion)

        await password_reset_repository.create_token(
            session,
            usuario_id=user.id,
            token=token,
            expiracion=expiracion,
        )
        print("[request_reset] Token guardado en BD")

        await session.commit()
        print("[request_reset] Commit hecho")

        base_url = settings.frontend_base_url.rstrip("/")
        reset_url = f"{base_url}/restablecer/{token}"
        print("[request_reset] URL de reseteo generada:", reset_url)

        # 👇 Aquí envolvemos el envío de email
        try:
            print("[request_reset] Enviando email a:", user.email)
            await email_service.send_password_reset(
                to=user.email,
                name=user.nombre_completo,
                reset_url=reset_url,
            )
            print("[request_reset] Email enviado CORRECTAMENTE ✅")
        except Exception as e:
            print("[request_reset] ❌ ERROR al enviar email:", repr(e))
            # Opcional: lanzar error hacia el cliente o sólo loggear
            # raise ApplicationError("No se pudo enviar el correo", status_code=500)

    async def reset_password(self, session: AsyncSession, *, token: str, new_password: str) -> None:
        print("[reset_password] INICIO, token recibido:", token)

        record = await password_reset_repository.get_by_token(session, token)
        print("[reset_password] Resultado get_by_token:", record)

        now = datetime.now(timezone.utc)
        print("[reset_password] Fecha/hora actual:", now)

        if not record:
            print("[reset_password] record es None -> token no existe")
        else:
            print("[reset_password] record.utilizado:", record.utilizado)
            print("[reset_password] record.expiracion:", record.expiracion)

        if not record or record.utilizado or record.expiracion < now:
            print("[reset_password] Token inválido o expirado, lanzando ApplicationError")
            raise ApplicationError(
                "El enlace de recuperación no es válido o expiró",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        # Buscar usuario
        print("[reset_password] Buscando usuario con id:", record.usuario_id)
        user = await user_repository.get_user_by_id(session, record.usuario_id)
        print("[reset_password] Resultado get_user_by_id:", user)

        if not user:
            print("[reset_password] Usuario no encontrado, lanzando ApplicationError 404")
            raise ApplicationError("Usuario no encontrado", status_code=status.HTTP_404_NOT_FOUND)

        # Actualizar password
        print("[reset_password] Actualizando contraseña del usuario id:", user.id)
        user.hash_password = security.hash_password(new_password)

        # Marcar token como usado
        print("[reset_password] Marcando token como utilizado...")
        await password_reset_repository.mark_used(session, record)

        # Commit final
        await session.commit()
        print("[reset_password] Commit hecho, FIN OK ✅")

password_service = PasswordService()
