from __future__ import annotations

from datetime import date, datetime

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class HistoryRecord(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    entidad: str
    accion: str
    descripcion: str
    severidad: str = "info"
    metadata: dict | None = None
    actor_id: int | None = None
    actor_nombre: str | None = None
    registrado_en: datetime


class HistoryFilters(BaseModel):
    entidad: str | None = Field(default=None)
    search: str | None = Field(default=None)
    disciplina: str | None = Field(default=None)
    institucion_id: int | None = Field(default=None)
    evento_id: int | None = Field(default=None)
    fecha_inicio: date | None = Field(default=None)
    fecha_fin: date | None = Field(default=None)
    severidad: str | None = Field(default=None)
    order: Literal["asc", "desc"] = Field(default="desc")
