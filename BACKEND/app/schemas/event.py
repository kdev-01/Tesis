from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

ALLOWED_EVENT_SEXES = {"F", "M", "MX"}


class EventInstitutionSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    institucion_id: int
    nombre: str | None = None
    email: str | None = None
    estado_invitacion: str | None = None


class Sport(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str


class Category(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    deporte_id: int
    edad_minima: int | None = None
    edad_maxima: int | None = None
    activo: bool | None = None


class EventScenario(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int | None = None
    escenario_id: int | None = None
    nombre_escenario: str
    escenario_nombre: str | None = None
    escenario_direccion: str | None = None


class Event(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    titulo: str
    descripcion: str | None = None
    estado: str
    sexo_evento: str
    deporte: Sport | None = None
    fecha_auditoria_inicio: date | None = None
    fecha_auditoria_fin: date | None = None
    fecha_campeonato_inicio: date | None = None
    fecha_campeonato_fin: date | None = None
    fecha_inscripcion_inicio: date | None = None
    fecha_inscripcion_fin: date | None = None
    periodo_academico: str | None = None
    documento_planeacion_url: str | None = None
    imagen_portada_url: str | None = None
    edad_minima_permitida: int | None = None
    edad_maxima_permitida: int | None = None
    instituciones_invitadas: list[EventInstitutionSummary] = Field(default_factory=list)
    categorias: list[Category] = Field(default_factory=list)
    escenarios: list[EventScenario] = Field(default_factory=list)
    etapa_actual: str | None = None
    eliminado: bool = False
    creado_en: datetime
    actualizado_en: datetime


class EventScenarioPayload(BaseModel):
    escenario_id: int | None = None
    nombre_escenario: str

    @field_validator("nombre_escenario")
    @classmethod
    def _strip_and_validate_name(cls, value: str) -> str:
        name = (value or "").strip()
        if not name:
            raise ValueError("El nombre del escenario es obligatorio")
        return name


class EventCreate(BaseModel):
    titulo: str
    descripcion: str | None = None
    sexo_evento: str
    deporte_id: int
    categorias: list[int]
    escenarios: list[EventScenarioPayload] = Field(default_factory=list)
    fecha_campeonato_inicio: date
    fecha_campeonato_fin: date
    fecha_inscripcion_inicio: date
    fecha_inscripcion_fin: date
    fecha_auditoria_inicio: date
    fecha_auditoria_fin: date
    estado: str | None = None
    instituciones_invitadas: list[int] = Field(default_factory=list)

    @field_validator("sexo_evento")
    @classmethod
    def _validate_event_sex(cls, value: str) -> str:
        normalized = (value or "").upper()
        if normalized not in ALLOWED_EVENT_SEXES:
            raise ValueError("Sexo del evento inválido")
        return normalized

    @field_validator("categorias")
    @classmethod
    def _sanitize_categories(cls, value: list[int]) -> list[int]:
        return [int(item) for item in value or []]

    @model_validator(mode="after")
    def _validate_dates(self) -> "EventCreate":
        _validate_event_dates(
            self.fecha_inscripcion_inicio,
            self.fecha_inscripcion_fin,
            self.fecha_auditoria_inicio,
            self.fecha_auditoria_fin,
            self.fecha_campeonato_inicio,
            self.fecha_campeonato_fin,
        )
        return self


class EventUpdate(BaseModel):
    titulo: str | None = None
    descripcion: str | None = None
    sexo_evento: str | None = None
    deporte_id: int | None = None
    categorias: list[int] | None = None
    escenarios: list[EventScenarioPayload] | None = None
    fecha_campeonato_inicio: date | None = None
    fecha_campeonato_fin: date | None = None
    fecha_inscripcion_inicio: date | None = None
    fecha_inscripcion_fin: date | None = None
    fecha_auditoria_inicio: date | None = None
    fecha_auditoria_fin: date | None = None
    estado: str | None = None
    instituciones_invitadas: list[int] | None = None
    remove_cover_image: bool | None = None

    @field_validator("sexo_evento")
    @classmethod
    def _validate_event_sex(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = (value or "").upper()
        if normalized not in ALLOWED_EVENT_SEXES:
            raise ValueError("Sexo del evento inválido")
        return normalized

    @field_validator("categorias")
    @classmethod
    def _sanitize_categories(cls, value: list[int] | None) -> list[int] | None:
        if value is None:
            return None
        return [int(item) for item in value]

    @model_validator(mode="after")
    def _validate_optional_dates(self) -> "EventUpdate":
        if {
            self.fecha_inscripcion_inicio,
            self.fecha_inscripcion_fin,
            self.fecha_auditoria_inicio,
            self.fecha_auditoria_fin,
            self.fecha_campeonato_inicio,
            self.fecha_campeonato_fin,
        } - {None}:
            _validate_event_dates(
                self.fecha_inscripcion_inicio,
                self.fecha_inscripcion_fin,
                self.fecha_auditoria_inicio,
                self.fecha_auditoria_fin,
                self.fecha_campeonato_inicio,
                self.fecha_campeonato_fin,
                allow_partial=True,
        )
        return self


class EventTimelineUpdate(BaseModel):
    fecha_inscripcion_inicio: date | None = None
    fecha_inscripcion_fin: date | None = None
    fecha_auditoria_inicio: date | None = None
    fecha_auditoria_fin: date | None = None
    fecha_campeonato_inicio: date | None = None
    fecha_campeonato_fin: date | None = None

    @model_validator(mode="after")
    def _validate_timeline(self) -> "EventTimelineUpdate":
        provided = [
            self.fecha_inscripcion_inicio,
            self.fecha_inscripcion_fin,
            self.fecha_auditoria_inicio,
            self.fecha_auditoria_fin,
            self.fecha_campeonato_inicio,
            self.fecha_campeonato_fin,
        ]
        if not any(value is not None for value in provided):
            raise ValueError("Debes enviar al menos una fecha para actualizar el cronograma")

        _validate_event_dates(
            self.fecha_inscripcion_inicio,
            self.fecha_inscripcion_fin,
            self.fecha_auditoria_inicio,
            self.fecha_auditoria_fin,
            self.fecha_campeonato_inicio,
            self.fecha_campeonato_fin,
            allow_partial=True,
        )
        return self


def _validate_event_dates(
    registration_start: date | None,
    registration_end: date | None,
    audit_start: date | None,
    audit_end: date | None,
    championship_start: date | None,
    championship_end: date | None,
    *,
    allow_partial: bool = False,
) -> None:
    values = [
        registration_start,
        registration_end,
        audit_start,
        audit_end,
        championship_start,
        championship_end,
    ]
    if allow_partial and any(value is None for value in values):
        # When allowing partial updates, skip validation if not all values provided
        provided = [value for value in values if value is not None]
        if len(provided) < 2:
            return
    elif not allow_partial and any(value is None for value in values):
        raise ValueError("Debes especificar todas las fechas del evento")

    if registration_start and registration_end and registration_start >= registration_end:
        raise ValueError("El inicio de inscripciones debe ser anterior al cierre")
    if registration_end and audit_start and audit_start <= registration_end:
        raise ValueError("La auditoría debe iniciar después de las inscripciones")
    if audit_start and audit_end and audit_start >= audit_end:
        raise ValueError("El inicio de auditoría debe ser anterior al fin")
    if audit_end and championship_start and championship_start <= audit_end:
        raise ValueError(
            "El campeonato debe iniciar después de la auditoría. Actualiza las fechas del campeonato si extiendes la auditoría"
        )
    if championship_start and championship_end and championship_start >= championship_end:
        raise ValueError("El campeonato debe finalizar después de iniciar")
