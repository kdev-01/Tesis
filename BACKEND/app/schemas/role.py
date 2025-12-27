from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class RoleBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    descripcion: str | None = None
    creado_en: datetime
    actualizado_en: datetime


class RoleCreate(BaseModel):
    nombre: str = Field(min_length=1)
    descripcion: str | None = None


class RoleUpdate(BaseModel):
    nombre: str | None = None
    descripcion: str | None = None
