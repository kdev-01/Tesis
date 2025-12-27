from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.mutable import MutableDict
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base

class Notificacion(Base):
    __tablename__ = "notificaciones"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    usuario_id: Mapped[int] = mapped_column(
        ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False, index=True
    )
    titulo: Mapped[str] = mapped_column(String(200), nullable=False)
    mensaje: Mapped[str | None] = mapped_column(Text)
    tipo: Mapped[str] = mapped_column(String(50), nullable=False, default="general")
    nivel: Mapped[str] = mapped_column(String(20), nullable=False, default="info")

    # 👇 cambio aquí
    data: Mapped[dict[str, Any] | None] = mapped_column(
        "metadata",  # <- nombre de la columna en la BD
        MutableDict.as_mutable(JSONB),
        nullable=True,
    )

    evento_id: Mapped[int | None] = mapped_column(
        ForeignKey("eventos.id", ondelete="SET NULL"), nullable=True
    )
    leido: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    leido_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    eliminado: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    eliminado_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    creado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    actualizado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        server_onupdate=func.now(),
    )

    usuario = relationship("Usuario", back_populates="notificaciones", lazy="joined")
    evento = relationship("Evento", back_populates="notificaciones", lazy="joined")
