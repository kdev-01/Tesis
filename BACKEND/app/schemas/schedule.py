from __future__ import annotations

from datetime import time

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ScheduleRequest(BaseModel):
    hora_inicio: time | None = Field(default=None, description="Hora de inicio de la jornada")
    hora_fin: time | None = Field(default=None, description="Hora de finalización de la jornada")
    duracion_horas: int | None = Field(default=None, gt=0, description="Duración de cada partido en horas")
    descanso_min_dias: int | None = Field(default=None, ge=0, description="Descanso mínimo entre partidos")
    force: bool = Field(default=False, description="Reemplazar el calendario existente")

    @field_validator("hora_fin")
    @classmethod
    def _ensure_order(cls, value: time | None, info):
        start: time | None = info.data.get("hora_inicio")
        if value is not None and start is not None and value <= start:
            raise ValueError("La hora de fin debe ser posterior a la hora de inicio")
        return value


class ScheduleMatch(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    fecha: str
    hora_inicio: time
    hora_fin: time
    escenario_id: int | None
    escenario_nombre: str | None
    fase: str | None
    serie: str | None
    ronda: str | None
    equipo_local: str
    equipo_local_id: int | None
    equipo_visitante: str
    equipo_visitante_id: int | None
    estado: str
    placeholder_local: str | None = None
    placeholder_visitante: str | None = None
