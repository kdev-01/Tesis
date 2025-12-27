from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from .base import Base


class AppEventLog(Base):
    __tablename__ = "app_event_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    entidad: Mapped[str] = mapped_column(String, nullable=False)
    entidad_id: Mapped[int | None] = mapped_column(Integer)

    accion: Mapped[str] = mapped_column(String, nullable=False)
    descripcion: Mapped[str] = mapped_column(Text, nullable=False)
    severidad: Mapped[str] = mapped_column(String, nullable=False, default="info")

    # ⬇️ RENOMBRADO: 'metadata' → 'datos_extra' (o 'meta', 'payload', etc.)
    datos_extra: Mapped[dict] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,  # default en ORM
        # Si prefieres default en BD además del ORM, usa Alembic para agregar:
        # server_default=text("'{}'::jsonb")
    )

    actor_id: Mapped[int | None] = mapped_column(ForeignKey("usuarios.id", ondelete="SET NULL"))
    actor_nombre: Mapped[str | None] = mapped_column(String)

    registrado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
