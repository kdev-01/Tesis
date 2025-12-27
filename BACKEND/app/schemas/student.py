from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.institution import InstitutionSummary


class Student(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    institucion_id: int | None
    nombres: str
    apellidos: str
    documento_identidad: str | None = None
    foto_url: str | None = None
    fecha_nacimiento: date
    genero: str | None = None
    activo: bool
    eliminado: bool
    eliminado_en: datetime | None = None
    eliminado_por: int | None = None
    creado_en: datetime
    actualizado_en: datetime
    institucion: InstitutionSummary | None = None


class StudentCreate(BaseModel):
    institucion_id: int = Field(ge=1)
    nombres: str = Field(min_length=1)
    apellidos: str = Field(min_length=1)
    documento_identidad: str | None = None
    foto_url: str | None = None
    fecha_nacimiento: date
    genero: str | None = None
    activo: bool = True


class StudentUpdate(BaseModel):
    institucion_id: int | None = None
    nombres: str | None = None
    apellidos: str | None = None
    documento_identidad: str | None = None
    foto_url: str | None = None
    fecha_nacimiento: date | None = None
    genero: str | None = None
    activo: bool | None = None
    remove_foto: bool | None = None
