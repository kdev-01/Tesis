from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.user import UserBase

NEWS_STATES = ("borrador", "programado", "publicado", "archivado")


class News(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    titulo: str
    slug: str
    resumen: str | None = None
    contenido: str
    categoria: str | None = None
    etiquetas: list[str] = Field(default_factory=list)
    estado: str
    destacado: bool = False
    orden: int = 0
    fecha_publicacion: datetime | None = None
    autor_id: int | None = None
    autor: UserBase | None = None
    creado_en: datetime
    actualizado_en: datetime


class NewsCreate(BaseModel):
    titulo: str
    resumen: str | None = None
    contenido: str
    categoria: str | None = None
    etiquetas: list[str] = Field(default_factory=list)
    estado: str = "borrador"
    destacado: bool = False
    orden: int | None = None
    fecha_publicacion: datetime | None = None
    slug: str | None = None


class NewsUpdate(BaseModel):
    titulo: str | None = None
    resumen: str | None = None
    contenido: str | None = None
    categoria: str | None = None
    etiquetas: list[str] | None = None
    estado: str | None = None
    destacado: bool | None = None
    orden: int | None = None
    fecha_publicacion: datetime | None = None
    slug: str | None = None
    autor_id: int | None = None


class NewsStateUpdate(BaseModel):
    estado: str
    fecha_publicacion: datetime | None = None
