from __future__ import annotations

from datetime import datetime
from typing import List, Literal

from datetime import datetime
from typing import List, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserCreate(BaseModel):
    nombre_completo: str = Field(min_length=1)
    email: EmailStr
    telefono: str | None = None
    password: str = Field(min_length=6)
    rol_id: int = Field(gt=0)
    activo: bool = True
    avatar_url: str | None = None
    tipo_sangre: Literal['A+','A-','B+','B-','AB+','AB-','O+','O-'] | None = None
    institucion_id: int | None = Field(default=None, gt=0)
    deporte_id: int | None = Field(default=None, gt=0)
    send_welcome: bool = False


class UserUpdate(BaseModel):
    nombre_completo: str | None = None
    email: EmailStr | None = None
    telefono: str | None = None
    password: str | None = Field(default=None, min_length=6)
    rol_id: int | None = Field(default=None, gt=0)
    activo: bool | None = None
    avatar_url: str | None = None
    remove_avatar: bool | None = None
    tipo_sangre: Literal['A+','A-','B+','B-','AB+','AB-','O+','O-'] | None = None
    institucion_id: int | None = Field(default=None, gt=0)
    deporte_id: int | None = Field(default=None, gt=0)


class UserBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre_completo: str
    email: EmailStr
    telefono: str | None = None
    avatar_url: str | None = None
    tipo_sangre: str | None = None
    activo: bool
    eliminado: bool
    roles: List[str] = Field(default_factory=list)
    role_ids: List[int] = Field(default_factory=list)
    rol_id: int | None = None
    rol: str | None = None
    permisos: List[str] = Field(default_factory=list)
    institucion_id: int | None = None
    institucion_nombre: str | None = None
    deporte_id: int | None = None
    deporte_nombre: str | None = None
    ultimo_acceso: datetime | None = None
    creado_en: datetime
    actualizado_en: datetime


class UserProfileUpdate(BaseModel):
    nombre_completo: str | None = None
    telefono: str | None = None
    avatar_url: str | None = None
    password_actual: str | None = Field(default=None, min_length=6)
    password_nueva: str | None = Field(default=None, min_length=6)
    remove_avatar: bool | None = None
    tipo_sangre: Literal['A+','A-','B+','B-','AB+','AB-','O+','O-'] | None = None
