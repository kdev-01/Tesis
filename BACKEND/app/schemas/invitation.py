from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class InvitationCreate(BaseModel):
    email: EmailStr
    rol_id: int = Field(gt=0)
    nombre: str | None = Field(default=None, max_length=255)


class InvitationPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    email: EmailStr
    nombre: str | None = None
    rol_id: int
    rol_nombre: str | None = None
    token: str
    expira_en: datetime
    aceptado_en: datetime | None = None
    creado_en: datetime


class InvitationAcceptRequest(BaseModel):
    nombre_completo: str = Field(min_length=1)
    telefono: str | None = Field(default=None, max_length=40)
    password: str = Field(min_length=6)
    avatar_url: str | None = None
    institucion_id: int | None = Field(default=None, gt=0)
    deporte_id: int | None = Field(default=None, gt=0)


class InvitationSupportItem(BaseModel):
    id: int
    nombre: str


class InvitationSupportData(BaseModel):
    deportes: list[InvitationSupportItem] = Field(default_factory=list)
    instituciones: list[InvitationSupportItem] = Field(default_factory=list)
