# app/models/asociaciones.py
from sqlalchemy import Column, ForeignKey, Integer, Table, UniqueConstraint

from app.models.base import Base

usuarios_roles = Table(
    "usuarios_roles",
    Base.metadata,
    Column("usuario_id", Integer, ForeignKey("usuarios.id", ondelete="CASCADE"), primary_key=True),
    Column("rol_id", Integer, ForeignKey("roles_sistema.id", ondelete="CASCADE"), primary_key=True),
    UniqueConstraint("usuario_id", "rol_id", name="uq_usuarios_roles"),
)
