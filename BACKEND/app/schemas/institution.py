from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


from pydantic import BaseModel, ConfigDict, EmailStr, Field
from datetime import datetime

class InstitutionSummary(BaseModel):
    id: int
    nombre: str
    # <-- importante
    model_config = ConfigDict(from_attributes=True)  # ✅

class Institution(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    nombre: str
    descripcion: str | None = None
    direccion: str | None = None
    ciudad: str | None = None
    email: EmailStr | None = None
    telefono: str | None = None
    portada_url: str | None = None
    estado: str
    motivo_desafiliacion: str | None = None
    fecha_desafiliacion: datetime | None = None
    fecha_reafiliacion: datetime | None = None
    sancion_motivo: str | None = None
    sancion_tipo: str | None = None
    sancion_inicio: datetime | None = None
    sancion_fin: datetime | None = None
    sancion_activa: bool
    eliminado: bool = False
    eliminado_en: datetime | None = None
    eliminado_por: int | None = None
    creado_en: datetime
    actualizado_en: datetime

class InstitutionCreate(BaseModel):
    nombre: str = Field(min_length=1)
    descripcion: str | None = None
    direccion: str | None = None
    ciudad: str | None = None
    email: EmailStr | None = None
    telefono: str | None = None
    portada_url: str | None = None
    estado: str = Field(default="activa")


class InstitutionUpdate(BaseModel):
    nombre: str | None = Field(default=None)
    descripcion: str | None = None
    direccion: str | None = None
    ciudad: str | None = None
    email: EmailStr | None = None
    telefono: str | None = None
    portada_url: str | None = None
    estado: str | None = None
    remove_portada: bool | None = Field(default=None)


class InstitutionDisaffiliation(BaseModel):
    motivo: str = Field(min_length=5, max_length=400)


class InstitutionReaffiliation(BaseModel):
    observaciones: str | None = Field(default=None, max_length=400)


class InstitutionSanction(BaseModel):
    motivo: str = Field(min_length=5, max_length=400)
    tipo: str = Field(min_length=3, max_length=80)
    fecha_inicio: datetime | None = None
    fecha_fin: datetime | None = None


class InstitutionSanctionLift(BaseModel):
    observaciones: str | None = Field(default=None, max_length=400)
