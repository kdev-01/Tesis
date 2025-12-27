from __future__ import annotations

import asyncio
from datetime import datetime
import smtplib
from email.message import EmailMessage

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class EmailService:
    def __init__(self) -> None:
        self.host = settings.smtp_host
        self.port = settings.smtp_port
        self.username = settings.smtp_user
        self.password = settings.smtp_password
        self.use_tls = settings.smtp_use_tls
        self.sender = settings.smtp_from
        print("SMTP CONFIG:", self.host, self.port, self.use_tls, self.username)


    async def send_email(self, *, to: str, subject: str, body: str) -> None:
        message = EmailMessage()
        message["From"] = self.sender
        message["To"] = to
        message["Subject"] = subject
        message.set_content(body)

        loop = asyncio.get_running_loop()
        # Si _send lanza, aquí también se va a lanzar (y verás el error en el endpoint)
        await loop.run_in_executor(None, self._send, message)


    def _send(self, message: EmailMessage) -> None:
        logger.info(
            "email.send.start",
            extra={
                "host": self.host,
                "port": self.port,
                "use_tls": self.use_tls,
                "username": self.username,
            },
        )

        try:
            if self.use_tls:
                # Caso típico: Gmail 587 + STARTTLS
                with smtplib.SMTP(self.host, self.port, timeout=20) as smtp:
                    smtp.set_debuglevel(1)  # DEBUG SMTP en consola (útil mientras depuras)
                    smtp.ehlo()
                    smtp.starttls()
                    smtp.ehlo()
                    if self.username:
                        smtp.login(self.username, self.password or "")
                    smtp.send_message(message)
            else:
                # Si usas puerto 465: SSL implícito
                with smtplib.SMTP_SSL(self.host, self.port, timeout=20) as smtp:
                    smtp.set_debuglevel(1)  # DEBUG SMTP
                    if self.username:
                        smtp.login(self.username, self.password or "")
                    smtp.send_message(message)

            logger.info(
                "email.sent",
                extra={"to": message["To"], "subject": message["Subject"]},
            )
        except smtplib.SMTPAuthenticationError as exc:
            logger.error(
                "email.auth_error",
                extra={
                    "error": str(exc),
                    "smtp_code": getattr(exc, "smtp_code", None),
                    "smtp_error": getattr(exc, "smtp_error", None),
                },
            )
            raise
        except Exception as exc:  # noqa: BLE001
            logger.error("email.error", extra={"error": str(exc)})
            raise

    async def send_login_notification(self, *, to: str, name: str) -> None:
        subject = "Nuevo inicio de sesión"
        body = f"Hola {name},\n\nSe registró un nuevo inicio de sesión en tu cuenta."
        await self.send_email(to=to, subject=subject, body=body)

    def enqueue_login_notification(self, *, to: str, name: str) -> None:
        asyncio.create_task(self.send_login_notification(to=to, name=name))

    async def send_password_reset(self, *, to: str, name: str, reset_url: str) -> None:
        subject = "Recupera el acceso a tu cuenta"
        body = (
            f"Hola {name},\n\n"
            "Recibimos una solicitud para restablecer tu contraseña. "
            f"Puedes crear una nueva contraseña segura ingresando en el siguiente enlace:\n{reset_url}\n\n"
            "Si no solicitaste este cambio, puedes ignorar este mensaje."
        )
        await self.send_email(to=to, subject=subject, body=body)

    async def send_welcome_email(self, *, to: str, name: str, access_url: str) -> None:
        subject = "Bienvenido a AGXport"
        body = (
            f"Hola {name},\n\n"
            "Tu cuenta en la plataforma AGXport ha sido creada. "
            "Puedes ingresar con tus credenciales en el siguiente enlace seguro:\n"
            f"{access_url}\n\n"
            "Si no esperabas este mensaje, comunícate con el administrador del sistema."
        )
        await self.send_email(to=to, subject=subject, body=body)

    async def send_invitation(
        self,
        *,
        to: str,
        role_name: str,
        invitation_url: str,
        inviter: str | None = None,
    ) -> None:
        subject = "Invitación para unirte a AGXport"
        if inviter:
            greeting = f"{inviter} te ha invitado a unirte al panel administrativo como {role_name}."
        else:
            greeting = f"Has sido invitado a unirte al panel administrativo como {role_name}."
        body = (
            f"Hola,\n\n{greeting}\n\n"
            f"Completa tu registro con el siguiente enlace seguro (vigente por 48 horas):\n{invitation_url}\n\n"
            "Si no estabas esperando esta invitación, omite este mensaje."
        )
        await self.send_email(to=to, subject=subject, body=body)

    async def send_event_created(
        self,
        *,
        to: str,
        institution_name: str | None,
        event_title: str,
        start_date,
        end_date,
        planning_url: str | None,
        portal_url: str,
    ) -> None:
        subject = "Nuevo evento deportivo registrado"
        saludo = institution_name or "Equipo educativo"
        detalles = []
        if start_date:
            detalles.append(f"Inicio tentativo: {start_date}")
        if end_date:
            detalles.append(f"Fin tentativo: {end_date}")
        detalles_text = "\n".join(detalles)
        planning_line = f"\nDocumento de planeación: {planning_url}" if planning_url else ""
        body = (
            f"Hola {saludo},\n\n"
            f"Se ha creado el evento \"{event_title}\" y tu institución ha sido invitada a participar."
        )
        if detalles_text:
            body += f"\n\n{detalles_text}"
        body += (
            "\n\nConsulta todos los detalles y el reglamento en el portal público:"\
            f"\n{portal_url}{planning_line}\n\n"
            "Si tienes preguntas, responde a este correo."
        )
        await self.send_email(to=to, subject=subject, body=body)

    def enqueue_event_created(
        self,
        *,
        to: str,
        institution_name: str | None,
        event_title: str,
        start_date,
        end_date,
        planning_url: str | None,
        portal_url: str,
    ) -> None:
        asyncio.create_task(
            self.send_event_created(
                to=to,
                institution_name=institution_name,
                event_title=event_title,
                start_date=start_date,
                end_date=end_date,
                planning_url=planning_url,
                portal_url=portal_url,
            )
        )

    async def send_event_invitation_notification(
        self,
        *,
        to: str,
        institution_name: str | None,
        event_title: str,
        notification_type: str,
        registration_start,
        registration_end,
        portal_url: str,
    ) -> None:
        saludo = institution_name or "Equipo educativo"
        if notification_type == "invitacion":
            subject = f"Invitación al evento {event_title}"
            opening = (
                "Tu institución ha sido invitada a participar en el evento deportivo. "
                "Confirma tu participación y revisa los requisitos de inscripción."
            )
        else:
            subject = f"Recordatorio de inscripción · {event_title}"
            opening = (
                "La etapa de inscripción del evento continúa activa. "
                "Completa o actualiza el registro de tu institución para no perder la plaza."
            )

        fechas = []
        if registration_start:
            fechas.append(f"Inicio de inscripciones: {registration_start}")
        if registration_end:
            fechas.append(f"Cierre de inscripciones: {registration_end}")
        fechas_line = "\n".join(fechas)

        body = f"Hola {saludo},\n\n{opening}"
        if fechas_line:
            body += f"\n\n{fechas_line}"
        body += (
            "\n\nGestiona la participación de tu institución en el siguiente enlace seguro:"\
            f"\n{portal_url}\n\n"
            "Si ya completaste el proceso, ignora este mensaje."
        )

        await self.send_email(to=to, subject=subject, body=body)

    def enqueue_event_invitation_notification(
        self,
        *,
        to: str,
        institution_name: str | None,
        event_title: str,
        notification_type: str,
        registration_start,
        registration_end,
        portal_url: str,
    ) -> None:
        asyncio.create_task(
            self.send_event_invitation_notification(
                to=to,
                institution_name=institution_name,
                event_title=event_title,
                notification_type=notification_type,
                registration_start=registration_start,
                registration_end=registration_end,
                portal_url=portal_url,
            )
        )


    async def send_event_registration_update(
        self,
        *,
        to: str,
        recipient_name: str | None,
        event_title: str,
        institution_name: str | None,
        actor_name: str,
        action_date: datetime,
        portal_url: str,
    ) -> None:
        subject = f"Actualización de inscripción · {event_title}"
        formatted_date = action_date.astimezone().strftime("%d/%m/%Y %H:%M")
        saludo = recipient_name or "Equipo de comisión"
        institucion = institution_name or "la institución"
        body = (
            f"Hola {saludo},\n\n"
            f"{actor_name} actualizó la inscripción de {institucion} el {formatted_date}."
            "\n\nRevisa los cambios en el panel administrativo:"\
            f"\n{portal_url}\n\n"
            "Si ya revisaste esta actualización, puedes ignorar este mensaje."
        )
        await self.send_email(to=to, subject=subject, body=body)

    def enqueue_event_registration_update(
        self,
        *,
        to: str,
        recipient_name: str | None,
        event_title: str,
        institution_name: str | None,
        actor_name: str,
        action_date: datetime,
        portal_url: str,
    ) -> None:
        asyncio.create_task(
            self.send_event_registration_update(
                to=to,
                recipient_name=recipient_name,
                event_title=event_title,
                institution_name=institution_name,
                actor_name=actor_name,
                action_date=action_date,
                portal_url=portal_url,
            )
        )

    async def send_event_audit_update(
        self,
        *,
        to: str,
        recipient_name: str | None,
        event_title: str,
        institution_name: str | None,
        actor_name: str,
        action_date: datetime,
        change_description: str,
        portal_url: str,
    ) -> None:
        subject = f"Novedades de auditoría · {event_title}"
        formatted_date = action_date.astimezone().strftime("%d/%m/%Y %H:%M")
        saludo = recipient_name or "Equipo educativo"
        institucion = institution_name or "tu institución"
        body = (
            f"Hola {saludo},\n\n"
            f"{actor_name} registró una novedad en la auditoría del evento para {institucion} el {formatted_date}."
            f"\n\nDetalle: {change_description}"
            "\n\nIngresa al panel para revisar las observaciones:"\
            f"\n{portal_url}\n\n"
            "Si ya atendiste esta notificación, puedes ignorar este mensaje."
        )
        await self.send_email(to=to, subject=subject, body=body)

    def enqueue_event_audit_update(
        self,
        *,
        to: str,
        recipient_name: str | None,
        event_title: str,
        institution_name: str | None,
        actor_name: str,
        action_date: datetime,
        change_description: str,
        portal_url: str,
    ) -> None:
        asyncio.create_task(
            self.send_event_audit_update(
                to=to,
                recipient_name=recipient_name,
                event_title=event_title,
                institution_name=institution_name,
                actor_name=actor_name,
                action_date=action_date,
                change_description=change_description,
                portal_url=portal_url,
            )
        )


email_service = EmailService()
