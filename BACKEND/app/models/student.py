from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base

if TYPE_CHECKING:
    from .institution import Institucion
    from .user import Usuario


class Estudiante(Base):
    __tablename__ = "estudiantes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    institucion_id: Mapped[int | None] = mapped_column(
        ForeignKey("instituciones.id", ondelete="SET NULL"), nullable=True
    )
    nombres: Mapped[str] = mapped_column(String, nullable=False)
    apellidos: Mapped[str] = mapped_column(String, nullable=False)
    documento_identidad: Mapped[str | None] = mapped_column(String)
    foto_url: Mapped[str | None] = mapped_column(String)
    fecha_nacimiento: Mapped[date] = mapped_column(Date, nullable=False)
    genero: Mapped[str | None] = mapped_column(String)
    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    eliminado: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    eliminado_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    eliminado_por: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True
    )
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    actualizado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    institucion: Mapped["Institucion"] = relationship(
        "Institucion",
        back_populates="estudiantes",
        lazy="joined",
    )
    eliminado_por_usuario: Mapped["Usuario | None"] = relationship(
        "Usuario",
        foreign_keys=[eliminado_por],
        lazy="joined",
    )
