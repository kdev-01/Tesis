from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import CITEXT
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from .base import Base

if TYPE_CHECKING:
    from .event import Deporte
    from .institution import Institucion
    from .notification import Notificacion
    from .security import (
        PasswordResetToken,
        RolePermission,
        UserInvitation,
    )


class RolSistema(Base):
    __tablename__ = "roles_sistema"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    descripcion: Mapped[str | None]
    creado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    actualizado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    usuarios: Mapped[List["Usuario"]] = relationship(
        back_populates="roles",
        secondary=lambda: UsuarioRol.__table__,
        lazy="selectin",  # selectin suele ser más eficiente que joined
    )
    permisos: Mapped[List["RolePermission"]] = relationship(
        "RolePermission",
        back_populates="rol",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    invitations: Mapped[List["UserInvitation"]] = relationship(
        "UserInvitation",
        back_populates="rol",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class Usuario(Base):
    __tablename__ = "usuarios"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nombre_completo: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(CITEXT, nullable=False, unique=True)
    telefono: Mapped[str | None] = mapped_column(String)
    tipo_sangre: Mapped[str | None] = mapped_column(String(3))
    avatar_url: Mapped[str | None] = mapped_column(String)
    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    hash_password: Mapped[str | None] = mapped_column(String)
    ultimo_acceso: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    eliminado: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    institucion_id: Mapped[int | None] = mapped_column(
        ForeignKey("instituciones.id", ondelete="SET NULL"), nullable=True
    )
    deporte_id: Mapped[int | None] = mapped_column(
        ForeignKey("deportes.id", ondelete="SET NULL"), nullable=True
    )
    creado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    actualizado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    roles: Mapped[List[RolSistema]] = relationship(
        back_populates="usuarios",
        secondary=lambda: UsuarioRol.__table__,
        lazy="selectin",
    )
    # inverso de Institucion.representantes
    institucion: Mapped[Optional["Institucion"]] = relationship(
        "Institucion",
        back_populates="representantes",
        foreign_keys=[institucion_id],   # 👈 clave para desambiguar
        lazy="selectin",
    )
    deporte: Mapped[Optional["Deporte"]] = relationship(
        "Deporte",
        lazy="selectin",
    )
    password_resets: Mapped[List["PasswordResetToken"]] = relationship(
        "PasswordResetToken",
        back_populates="usuario",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    notificaciones: Mapped[List["Notificacion"]] = relationship(
        "Notificacion",
        back_populates="usuario",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class UsuarioRol(Base):
    __tablename__ = "usuarios_roles"

    usuario_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("usuarios.id", ondelete="CASCADE"),
        primary_key=True,
    )
    rol_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("roles_sistema.id", ondelete="CASCADE"),
        primary_key=True,
    )
