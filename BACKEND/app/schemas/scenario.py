from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class Scenario(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    direccion: str | None = None
    ciudad: str | None = None
    capacidad: int | None = None
    activo: bool
    foto_url: str | None = None
    creado_en: datetime
    actualizado_en: datetime


class ScenarioCreate(BaseModel):
    nombre: str = Field(min_length=1, max_length=120)
    direccion: str | None = Field(default=None, max_length=255)
    ciudad: str | None = Field(default=None, max_length=120)
    capacidad: int | None = Field(default=None, ge=0)
    foto_url: str | None = None


class ScenarioUpdate(BaseModel):
    nombre: str | None = Field(default=None, min_length=1, max_length=120)
    direccion: str | None = Field(default=None, max_length=255)
    ciudad: str | None = Field(default=None, max_length=120)
    capacidad: int | None = Field(default=None, ge=0)
    foto_url: str | None = None
    activo: bool | None = None
