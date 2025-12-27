from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class SportConfig(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    activo: bool
    creado_en: datetime
    actualizado_en: datetime


class SportCreateRequest(BaseModel):
    nombre: str
    activo: bool = True


class SportUpdateRequest(BaseModel):
    nombre: str | None = None
    activo: bool | None = None


class CategoryConfig(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    deporte_id: int
    nombre: str
    edad_minima: int | None = Field(default=None, ge=0, le=120)
    edad_maxima: int | None = Field(default=None, ge=0, le=120)
    activo: bool
    creado_en: datetime
    actualizado_en: datetime


class CategoryCreateRequest(BaseModel):
    deporte_id: int
    nombre: str
    edad_minima: int | None = Field(default=None, ge=0, le=120)
    edad_maxima: int | None = Field(default=None, ge=0, le=120)
    activo: bool = True


class CategoryUpdateRequest(BaseModel):
    nombre: str | None = None
    edad_minima: int | None = Field(default=None, ge=0, le=120)
    edad_maxima: int | None = Field(default=None, ge=0, le=120)
    activo: bool | None = None
