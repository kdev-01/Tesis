from __future__ import annotations

from datetime import date, datetime, time
from typing import List

from datetime import date, datetime, time

from pydantic import BaseModel, ConfigDict, Field, FieldValidationInfo, field_validator

from app.schemas.event import Category, Sport


class InstitutionRule(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    min_participantes: int
    max_participantes: int
    observaciones: str | None = None


class InstitutionRuleUpdate(BaseModel):
    min_participantes: int = Field(ge=0)
    max_participantes: int = Field(ge=0)
    observaciones: str | None = None

    @field_validator("max_participantes")
    @classmethod
    def _validate_max(cls, value: int, info: FieldValidationInfo):
        min_value = info.data.get("min_participantes")
        if min_value is not None and value and value < min_value:
            raise ValueError("El máximo debe ser mayor o igual al mínimo")
        return value


class InvitationSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    evento_id: int
    evento_institucion_id: int | None = None
    institucion_id: int | None = None
    titulo: str
    descripcion: str | None = None
    deporte: Sport | None = None
    sexo_evento: str
    estado_invitacion: str
    estado_auditoria: str | None = None
    habilitado_campeonato: bool = False
    fecha_inscripcion_inicio: date | None = None
    fecha_inscripcion_fin: date | None = None
    fecha_inscripcion_extendida: date | None = None
    etapa_actual: str | None = None
    cantidad_inscritos: int = 0
    institucion_nombre: str | None = None
    institucion_portada_url: str | None = None
    ultima_version_enviada_en: datetime | None = None
    motivo_rechazo: str | None = None
    sexo_valido: bool | None = None
    documentacion_completa: bool | None = None
    edad_minima_permitida: int | None = None
    edad_maxima_permitida: int | None = None


class InvitationNotificationPayload(BaseModel):
    tipo: str | None = Field(default="recordatorio")

    @field_validator("tipo")
    @classmethod
    def _normalize_type(cls, value: str | None) -> str:
        normalized = (value or "recordatorio").strip().lower()
        if normalized not in {"invitacion", "recordatorio"}:
            raise ValueError("Tipo de notificación inválido")
        return normalized


class InvitationNotificationResult(BaseModel):
    enviados: int = 0


class RegistrationStudent(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombres: str
    apellidos: str
    documento_identidad: str | None = None
    genero: str | None = None
    fecha_nacimiento: date
    foto_url: str | None = None
    activo: bool | None = None
    creado_en: datetime | None = None
    documentos: List["RegistrationStudentDocument"] = Field(default_factory=list)


class RegistrationStudentDocument(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    tipo_documento: str
    archivo_url: str
    subido_en: datetime | None = None
    estado_revision: str | None = None
    observaciones_revision: str | None = None
    revisado_en: datetime | None = None
    revisado_por_id: int | None = None
    revisado_por_nombre: str | None = None


class StudentDocumentUploadPayload(BaseModel):
    estudiante_id: int
    tipo_documento: str


class StudentDocumentBatchUpload(BaseModel):
    documentos: List[StudentDocumentUploadPayload] = Field(default_factory=list)


class StudentDocumentUploadStatus(BaseModel):
    estudiante_id: int
    tipo_documento: str
    exito: bool
    mensaje: str | None = None
    nombre_archivo: str | None = None


class StudentDocumentBatchSummary(BaseModel):
    exitosos: int = 0
    fallidos: int = 0


class StudentDocumentBatchResult(BaseModel):
    resumen: StudentDocumentBatchSummary
    resultados: List[StudentDocumentUploadStatus] = Field(default_factory=list)


class StudentDocumentType(BaseModel):
    id: str
    etiqueta: str


class RegistrationTeam(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    institucion_id: int | None = None
    institucion_nombre: str | None = None
    categoria: Category | None = None
    nombre_equipo: str
    aprobado: bool
    bloqueado: bool
    ultima_version_enviada_en: datetime | None = None
    estudiantes: List[RegistrationStudent] = Field(default_factory=list)


class RegistrationSnapshot(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    evento_id: int
    institucion_id: int
    estudiantes: List[RegistrationStudent] = Field(default_factory=list)
    etapa_actual: str
    fecha_inscripcion_fin: date | None = None
    fecha_inscripcion_extendida: date | None = None
    fecha_auditoria_fin: date | None = None
    estado_auditoria: str | None = None
    estado_invitacion: str | None = None
    mensaje_auditoria: str | None = None
    ultima_revision_enviada_en: datetime | None = None
    sexo_evento: str | None = None
    edicion_bloqueada: bool = False
    categorias: List[Category] = Field(default_factory=list)
    edad_minima_permitida: int | None = None
    edad_maxima_permitida: int | None = None


class RegistrationPayload(BaseModel):
    estudiantes: List[int] = Field(default_factory=list)

    @field_validator("estudiantes")
    @classmethod
    def _validate_students(cls, value: List[int]) -> List[int]:
        unique = []
        seen = set()
        for item in value or []:
            ident = int(item)
            if ident not in seen:
                seen.add(ident)
                unique.append(ident)
        return unique


class RegistrationExtensionPayload(BaseModel):
    fecha_inscripcion_extendida: date | None = None

class EventInstitutionCreate(BaseModel):
    institucion_id: int = Field(gt=0)


class StudentDocumentReviewItem(BaseModel):
    documento_id: int = Field(gt=0)
    estado: str = Field(default="pendiente")
    observaciones: str | None = None

    @field_validator("estado")
    @classmethod
    def _normalize_state(cls, value: str) -> str:
        normalized = (value or "pendiente").strip().lower()
        if normalized not in {"pendiente", "aprobado", "correccion"}:
            raise ValueError("Estado de revisión no válido")
        return normalized


class StudentDocumentReviewPayload(BaseModel):
    documentos: List[StudentDocumentReviewItem] = Field(default_factory=list)


class AuditDecisionPayload(BaseModel):
    decision: str = Field(pattern="^(aprobar|rechazar|corregir)$")
    motivo: str | None = None

    @field_validator("motivo")
    @classmethod
    def _require_reason(cls, value: str | None, info: FieldValidationInfo):
        decision = info.data.get("decision")
        if decision == "rechazar" and not (value and value.strip()):
            raise ValueError("Debes indicar el motivo del rechazo")
        return value


class AuditDecisionBatchPayload(BaseModel):
    instituciones: list[int] = Field(min_length=1)
    decision: str = Field(pattern="^(aprobar|rechazar|corregir)$")
    motivo: str | None = None

    @field_validator("instituciones")
    @classmethod
    def _validate_institutions(cls, value: list[int]):
        unique_ids = [item for item in {int(item) for item in value if int(item) > 0}]
        if not unique_ids:
            raise ValueError("Debes seleccionar al menos una institución válida")
        return unique_ids

    @field_validator("motivo")
    @classmethod
    def _require_reason(cls, value: str | None, info: FieldValidationInfo):
        decision = info.data.get("decision")
        if decision == "rechazar" and not (value and value.strip()):
            raise ValueError("Debes indicar el motivo del rechazo")
        return value


class FixtureMatch(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    fecha: date
    hora: time
    hora_fin: time | None = None
    escenario_id: int | None = None
    escenario_nombre: str | None = None
    categoria: Category | None = None
    equipo_local: RegistrationTeam | None = None
    equipo_visitante: RegistrationTeam | None = None
    puntaje_local: int | None = None
    puntaje_visitante: int | None = None
    criterio_resultado: str | None = None
    ganador: RegistrationTeam | None = None
    placeholder_local: str | None = None
    placeholder_visitante: str | None = None
    noticia_publicada: bool = False
    fase: str | None = None
    serie: str | None = None
    ronda: str | None = None
    llave: str | None = None
    observaciones: str | None = None
    estado: str | None = None
    resultado_local: str | None = None
    resultado_visitante: str | None = None


class StandingRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    equipo_id: int
    equipo_nombre: str | None = None
    institucion_nombre: str | None = None
    puntos: int = 0
    partidos_jugados: int = 0
    ganados: int = 0
    empatados: int = 0
    perdidos: int = 0
    goles_a_favor: int = 0
    goles_en_contra: int = 0
    diferencia: int = 0


class StandingTable(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    serie: str | None = None
    posiciones: List[StandingRow] = Field(default_factory=list)


class FixturePayloadMatch(BaseModel):
    fecha: date
    hora: time
    escenario_evento_id: int | None = None
    categoria_id: int | None = None
    equipo_local_id: int | None = None
    equipo_visitante_id: int | None = None
    ronda: str | None = None
    llave: str | None = None
    observaciones: str | None = None


class FixturePayload(BaseModel):
    partidos: List[FixturePayloadMatch] = Field(default_factory=list)


class MatchResultPayload(BaseModel):
    puntaje_local: int = Field(ge=0)
    puntaje_visitante: int = Field(ge=0)
    criterio_resultado: str | None = Field(default=None, max_length=50)
    ganador_inscripcion_id: int
    publicar_noticia: bool = False
