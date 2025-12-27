from __future__ import annotations

from datetime import datetime, date
from typing import Any, Dict, List

from pydantic import BaseModel, Field


class NotificationEventInfo(BaseModel):
    id: int
    titulo: str
    estado: str | None = None
    deporte: str | None = None
    fecha_inscripcion_inicio: date | None = None
    fecha_inscripcion_fin: date | None = None


class Notification(BaseModel):
    id: int
    titulo: str
    mensaje: str | None = None
    tipo: str
    nivel: str
    metadata: Dict[str, Any] | None = None
    evento: NotificationEventInfo | None = None
    leido: bool
    leido_en: datetime | None = None
    creado_en: datetime


class NotificationSummary(BaseModel):
    total_sin_leer: int = Field(default=0)
    recientes: List[Notification] = Field(default_factory=list)


class NotificationMarkPayload(BaseModel):
    leido: bool = True


class NotificationBulkMarkPayload(BaseModel):
    leido: bool = True


class NotificationClearResult(BaseModel):
    eliminadas: int = 0


class NotificationBulkUpdateResult(BaseModel):
    actualizadas: int = 0
