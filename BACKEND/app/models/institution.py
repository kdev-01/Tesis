from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import CITEXT
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from .base import Base

if TYPE_CHECKING:
    from .user import Usuario
    from .student import Estudiante  # ajusta el nombre del módulo según tu proyecto


class Institucion(Base):
    __tablename__ = "instituciones"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    descripcion: Mapped[str | None] = mapped_column(Text)
    direccion: Mapped[str | None] = mapped_column(Text)
    ciudad: Mapped[str | None] = mapped_column(String)
    email: Mapped[str | None] = mapped_column(CITEXT)
    telefono: Mapped[str | None] = mapped_column(String)
    portada_url: Mapped[str | None] = mapped_column(Text)
    estado: Mapped[str] = mapped_column(String, nullable=False)
    motivo_desafiliacion: Mapped[str | None] = mapped_column(Text)
    fecha_desafiliacion: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    fecha_reafiliacion: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sancion_motivo: Mapped[str | None] = mapped_column(Text)
    sancion_tipo: Mapped[str | None] = mapped_column(String)
    sancion_inicio: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sancion_fin: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sancion_activa: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    eliminado: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    eliminado_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    eliminado_por: Mapped[int | None] = mapped_column(
        ForeignKey("usuarios.id", ondelete="SET NULL")
    )

    # Recomendado: defaults de BD para evitar errores en inserts si no los seteas en código
    creado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    actualizado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), server_onupdate=func.now()
    )

    # Relaciones
    estudiantes: Mapped[list[Estudiante]] = relationship(
        back_populates="institucion",
        lazy="selectin",
    )

    representantes: Mapped[list["Usuario"]] = relationship(
        "Usuario",
        back_populates="institucion",
        foreign_keys="Usuario.institucion_id",                # 👈 especifica qué FK usa esta relación
        primaryjoin="Usuario.institucion_id == Institucion.id",  # 👈 une por esa FK
        lazy="selectin",
    )

    eliminado_por_usuario: Mapped["Usuario | None"] = relationship(
        "Usuario",
        foreign_keys=[eliminado_por],   # columna local que apunta a usuarios.id
        lazy="joined",
    )
