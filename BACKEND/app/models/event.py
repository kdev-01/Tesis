from __future__ import annotations

from datetime import date, datetime, time
from typing import TYPE_CHECKING, List

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Float,
    String,
    Text,
    UniqueConstraint,
    Time,
    func,
    CheckConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base

if TYPE_CHECKING:
    from .institution import Institucion
    from .notification import Notificacion
    from .student import Estudiante
    from .user import Usuario


class Evento(Base):
    __tablename__ = "eventos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    administrador_id: Mapped[int] = mapped_column(
        ForeignKey("usuarios.id", ondelete="RESTRICT"), nullable=False
    )
    titulo: Mapped[str] = mapped_column(String, nullable=False)
    descripcion: Mapped[str | None] = mapped_column(Text)
    estado: Mapped[str] = mapped_column(String, nullable=False)
    sexo_evento: Mapped[str] = mapped_column(String(2), nullable=False)
    deporte_id: Mapped[int] = mapped_column(
        ForeignKey("deportes.id", ondelete="RESTRICT"), nullable=False
    )
    fecha_inscripcion_inicio: Mapped[date | None] = mapped_column(Date)
    fecha_inscripcion_fin: Mapped[date | None] = mapped_column(Date)
    fecha_auditoria_inicio: Mapped[date | None] = mapped_column(Date)
    fecha_auditoria_fin: Mapped[date | None] = mapped_column(Date)
    fecha_campeonato_inicio: Mapped[date | None] = mapped_column(Date)
    fecha_campeonato_fin: Mapped[date | None] = mapped_column(Date)
    periodo_academico: Mapped[str | None] = mapped_column(String)
    documento_planeacion: Mapped[str | None] = mapped_column(Text)
    imagen_portada: Mapped[str | None] = mapped_column(Text)
    eliminado: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    actualizado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    deporte: Mapped["Deporte"] = relationship(
        "Deporte", back_populates="eventos", lazy="joined"
    )

    instituciones_invitadas: Mapped[List["EventoInstitucion"]] = relationship(
        "EventoInstitucion",
        back_populates="evento",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    categorias: Mapped[List["CategoriaDeportiva"]] = relationship(
        "CategoriaDeportiva",
        secondary="evento_categorias",
        back_populates="eventos",
        lazy="selectin",
        order_by="CategoriaDeportiva.nombre",
    )
    escenarios: Mapped[List["EventoEscenario"]] = relationship(
        "EventoEscenario",
        back_populates="evento",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    configuracion: Mapped[EventoConfiguracion | None] = relationship(
        "EventoConfiguracion",
        back_populates="evento",
        lazy="joined",
        cascade="all, delete-orphan",
        uselist=False,
    )


    inscripciones: Mapped[List["EventoInscripcion"]] = relationship(
        "EventoInscripcion",
        back_populates="evento",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    auditorias: Mapped[List["EventoAuditoria"]] = relationship(
        "EventoAuditoria",
        back_populates="evento",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    partidos: Mapped[List["EventoPartido"]] = relationship(
        "EventoPartido",
        back_populates="evento",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    notificaciones: Mapped[List["Notificacion"]] = relationship(
        "Notificacion",
        back_populates="evento",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class EventoInstitucion(Base):
    __tablename__ = "evento_instituciones"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    evento_id: Mapped[int] = mapped_column(
        ForeignKey("eventos.id", ondelete="CASCADE"), nullable=False
    )
    institucion_id: Mapped[int] = mapped_column(
        ForeignKey("instituciones.id", ondelete="CASCADE"), nullable=False
    )
    estado_invitacion: Mapped[str] = mapped_column(String, nullable=False, default="pendiente")
    ultima_version_enviada_en: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    estado_auditoria: Mapped[str] = mapped_column(String, nullable=False, default="pendiente")
    motivo_rechazo: Mapped[str | None] = mapped_column(Text)
    habilitado_campeonato: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    fecha_inscripcion_extendida: Mapped[date | None] = mapped_column(Date, nullable=True)
    creado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # Relaciones
    evento: Mapped[Evento] = relationship(back_populates="instituciones_invitadas")
    institucion: Mapped[Institucion] = relationship(lazy="joined")

    # one-to-one opcional (uselist=False) — ¡sin comillas y con | None!
    reglas: Mapped[EventoInstitucionRegla | None] = relationship(
        back_populates="evento_institucion",
        cascade="all, delete-orphan",
        uselist=False,
        lazy="selectin",
        single_parent=True,  # recomendado para delete-orphan en relaciones 1-1
    )

    # one-to-many
    inscripciones: Mapped[list[EventoInscripcion]] = relationship(
        back_populates="evento_institucion",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    auditorias: Mapped[list[EventoAuditoria]] = relationship(
        back_populates="evento_institucion",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    documentos_pendientes: Mapped[
        List["EventoInscripcionDocumentoPendiente"]
    ] = relationship(
        "EventoInscripcionDocumentoPendiente",
        back_populates="evento_institucion",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

class Deporte(Base):
    __tablename__ = "deportes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    creado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    actualizado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        server_onupdate=func.now(),
    )

    eventos: Mapped[List[Evento]] = relationship(
        "Evento", back_populates="deporte", lazy="selectin"
    )
    categorias: Mapped[List["CategoriaDeportiva"]] = relationship(
        "CategoriaDeportiva", back_populates="deporte", lazy="selectin"
    )


class CategoriaDeportiva(Base):
    __tablename__ = "categorias_deportivas"
    __table_args__ = (
        UniqueConstraint("deporte_id", "nombre", name="uq_categoria_deporte_nombre"),
        CheckConstraint(
            "(edad_minima IS NULL OR edad_maxima IS NULL OR edad_minima <= edad_maxima)",
            name="ck_categoria_rango_edades",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    deporte_id: Mapped[int] = mapped_column(
        ForeignKey("deportes.id", ondelete="CASCADE"), nullable=False
    )
    nombre: Mapped[str] = mapped_column(String, nullable=False)
    edad_minima: Mapped[int | None] = mapped_column(Integer, nullable=True)
    edad_maxima: Mapped[int | None] = mapped_column(Integer, nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    creado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    actualizado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        server_onupdate=func.now(),
    )

    deporte: Mapped[Deporte] = relationship("Deporte", back_populates="categorias")
    eventos: Mapped[List[Evento]] = relationship(
        "Evento",
        secondary="evento_categorias",
        back_populates="categorias",
        lazy="selectin",
    )


class EventoCategoria(Base):
    __tablename__ = "evento_categorias"
    __table_args__ = (
        UniqueConstraint("evento_id", "categoria_id", name="uq_evento_categoria"),
    )

    evento_id: Mapped[int] = mapped_column(
        ForeignKey("eventos.id", ondelete="CASCADE"), primary_key=True
    )
    categoria_id: Mapped[int] = mapped_column(
        ForeignKey("categorias_deportivas.id", ondelete="CASCADE"), primary_key=True
    )
    creado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    evento: Mapped[Evento] = relationship("Evento", viewonly=True)
    categoria: Mapped[CategoriaDeportiva] = relationship(
        "CategoriaDeportiva", viewonly=True
    )


class EventoEscenario(Base):
    __tablename__ = "evento_escenarios"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    evento_id: Mapped[int] = mapped_column(
        ForeignKey("eventos.id", ondelete="CASCADE"), nullable=False
    )
    escenario_id: Mapped[int | None] = mapped_column(
        ForeignKey("localizaciones.id", ondelete="SET NULL"), nullable=True
    )
    nombre_escenario: Mapped[str] = mapped_column(String, nullable=False)
    creado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    evento: Mapped[Evento] = relationship("Evento", back_populates="escenarios")
    escenario: Mapped["EscenarioDeportivo"] = relationship("EscenarioDeportivo", lazy="joined")


class EventoConfiguracion(Base):
    __tablename__ = "evento_config"

    evento_id: Mapped[int] = mapped_column(
        ForeignKey("eventos.id", ondelete="CASCADE"), primary_key=True
    )
    hora_inicio: Mapped[time] = mapped_column(Time, nullable=False, default=time(8, 0))
    hora_fin: Mapped[time] = mapped_column(Time, nullable=False, default=time(18, 0))
    duracion_horas: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    descanso_min_dias: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    actualizado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    evento: Mapped[Evento] = relationship("Evento", back_populates="configuracion")


class EventoInstitucionRegla(Base):
    __tablename__ = "evento_institucion_reglas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    evento_institucion_id: Mapped[int] = mapped_column(
        ForeignKey("evento_instituciones.id", ondelete="CASCADE"), nullable=False
    )
    min_participantes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    max_participantes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    observaciones: Mapped[str | None] = mapped_column(Text)
    creado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    actualizado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        server_onupdate=func.now(),
    )

    evento_institucion: Mapped[EventoInstitucion] = relationship(
        "EventoInstitucion", back_populates="reglas"
    )


class EventoInscripcion(Base):
    __tablename__ = "evento_inscripciones"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    evento_id: Mapped[int] = mapped_column(
        ForeignKey("eventos.id", ondelete="CASCADE"), nullable=False
    )
    evento_institucion_id: Mapped[int] = mapped_column(
        ForeignKey("evento_instituciones.id", ondelete="CASCADE"), nullable=False
    )
    categoria_id: Mapped[int | None] = mapped_column(
        ForeignKey("categorias_deportivas.id", ondelete="RESTRICT"), nullable=True
    )
    nombre_equipo: Mapped[str] = mapped_column(Text, nullable=False, default="")
    aprobado: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    bloqueado: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    ultima_version_enviada_en: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    creado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    actualizado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        server_onupdate=func.now(),
    )

    evento: Mapped[Evento] = relationship("Evento", back_populates="inscripciones")
    evento_institucion: Mapped[EventoInstitucion] = relationship(
        "EventoInstitucion", back_populates="inscripciones"
    )
    categoria: Mapped[CategoriaDeportiva] = relationship(
        "CategoriaDeportiva", lazy="joined"
    )
    estudiantes: Mapped[List["EventoInscripcionEstudiante"]] = relationship(
        "EventoInscripcionEstudiante",
        back_populates="inscripcion",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class EventoInscripcionEstudiante(Base):
    __tablename__ = "evento_inscripcion_estudiantes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    inscripcion_id: Mapped[int] = mapped_column(
        ForeignKey("evento_inscripciones.id", ondelete="CASCADE"), nullable=False
    )
    estudiante_id: Mapped[int] = mapped_column(
        ForeignKey("estudiantes.id", ondelete="RESTRICT"), nullable=False
    )
    creado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    inscripcion: Mapped[EventoInscripcion] = relationship(
        "EventoInscripcion", back_populates="estudiantes"
    )
    estudiante: Mapped["Estudiante"] = relationship("Estudiante", lazy="joined")
    documentos: Mapped[List["EventoInscripcionEstudianteDocumento"]] = relationship(
        "EventoInscripcionEstudianteDocumento",
        back_populates="estudiante_inscrito",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class EventoInscripcionEstudianteDocumento(Base):
    __tablename__ = "evento_inscripcion_estudiante_documentos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    estudiante_inscripcion_id: Mapped[int] = mapped_column(
        ForeignKey("evento_inscripcion_estudiantes.id", ondelete="CASCADE"),
        nullable=False,
    )
    tipo_documento: Mapped[str] = mapped_column(String(50), nullable=False)
    archivo_url: Mapped[str] = mapped_column(Text, nullable=False)
    subido_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    estado_revision: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pendiente"
    )
    observaciones_revision: Mapped[str | None] = mapped_column(Text)
    revisado_por_id: Mapped[int | None] = mapped_column(
        ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True
    )
    revisado_en: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    estudiante_inscrito: Mapped[EventoInscripcionEstudiante] = relationship(
        "EventoInscripcionEstudiante", back_populates="documentos"
    )
    revisado_por: Mapped[Usuario | None] = relationship("Usuario", lazy="joined")


class EventoInscripcionDocumentoPendiente(Base):
    __tablename__ = "evento_inscripcion_documentos_pendientes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    evento_institucion_id: Mapped[int] = mapped_column(
        ForeignKey("evento_instituciones.id", ondelete="CASCADE"),
        nullable=False,
    )
    estudiante_id: Mapped[int] = mapped_column(
        ForeignKey("estudiantes.id", ondelete="RESTRICT"), nullable=False
    )
    tipo_documento: Mapped[str] = mapped_column(String(50), nullable=False)
    archivo_url: Mapped[str] = mapped_column(Text, nullable=False)
    subido_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    evento_institucion: Mapped[EventoInstitucion] = relationship(
        "EventoInstitucion", back_populates="documentos_pendientes"
    )


class EventoAuditoria(Base):
    __tablename__ = "evento_auditorias"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    evento_id: Mapped[int] = mapped_column(
        ForeignKey("eventos.id", ondelete="CASCADE"), nullable=False
    )
    evento_institucion_id: Mapped[int] = mapped_column(
        ForeignKey("evento_instituciones.id", ondelete="CASCADE"), nullable=False
    )
    accion: Mapped[str] = mapped_column(String, nullable=False)
    motivo: Mapped[str | None] = mapped_column(Text)
    actor_id: Mapped[int | None] = mapped_column(
        ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True
    )
    registrado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    evento: Mapped[Evento] = relationship("Evento", back_populates="auditorias")
    evento_institucion: Mapped[EventoInstitucion] = relationship(
        "EventoInstitucion", back_populates="auditorias"
    )


class EventoPartido(Base):
    __tablename__ = "eventos_partidos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    evento_id: Mapped[int] = mapped_column(
        ForeignKey("eventos.id", ondelete="CASCADE"), nullable=False
    )
    fecha: Mapped[date] = mapped_column(Date, nullable=False)
    hora: Mapped[time] = mapped_column(Time, nullable=False)
    hora_fin: Mapped[time | None] = mapped_column(Time, nullable=True)
    escenario_evento_id: Mapped[int | None] = mapped_column(
        ForeignKey("evento_escenarios.id", ondelete="SET NULL"), nullable=True
    )
    categoria_id: Mapped[int | None] = mapped_column(
        ForeignKey("categorias_deportivas.id", ondelete="SET NULL"), nullable=True
    )
    equipo_local_id: Mapped[int | None] = mapped_column(
        ForeignKey("evento_inscripciones.id", ondelete="SET NULL"), nullable=True
    )
    equipo_visitante_id: Mapped[int | None] = mapped_column(
        ForeignKey("evento_inscripciones.id", ondelete="SET NULL"), nullable=True
    )
    puntaje_local: Mapped[int | None] = mapped_column(Integer, nullable=True)
    puntaje_visitante: Mapped[int | None] = mapped_column(Integer, nullable=True)
    criterio_resultado: Mapped[str | None] = mapped_column(String(50), nullable=True)
    ganador_inscripcion_id: Mapped[int | None] = mapped_column(
        ForeignKey("evento_inscripciones.id", ondelete="SET NULL"), nullable=True
    )
    noticia_publicada: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
    )
    fase: Mapped[str | None] = mapped_column(String(50), nullable=True)
    serie: Mapped[str | None] = mapped_column(String(50), nullable=True)
    ronda: Mapped[str | None] = mapped_column(String)
    llave: Mapped[str | None] = mapped_column(String)
    observaciones: Mapped[str | None] = mapped_column(Text)
    estado: Mapped[str] = mapped_column(String(30), nullable=False, default="programado")
    placeholder_local: Mapped[str | None] = mapped_column(Text)
    placeholder_visitante: Mapped[str | None] = mapped_column(Text)
    creado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    evento: Mapped[Evento] = relationship("Evento", back_populates="partidos")
    escenario: Mapped[EventoEscenario] = relationship("EventoEscenario", lazy="joined")
    categoria: Mapped[CategoriaDeportiva] = relationship(
        "CategoriaDeportiva", lazy="joined"
    )
    equipo_local: Mapped[EventoInscripcion | None] = relationship(
        "EventoInscripcion",
        foreign_keys=[equipo_local_id],
        lazy="joined",
    )
    equipo_visitante: Mapped[EventoInscripcion | None] = relationship(
        "EventoInscripcion",
        foreign_keys=[equipo_visitante_id],
        lazy="joined",
    )
    ganador_inscripcion: Mapped[EventoInscripcion | None] = relationship(
        "EventoInscripcion", foreign_keys=[ganador_inscripcion_id], lazy="joined"
    )

    performances: Mapped[List["EventoPartidoEstudianteRendimiento"]] = relationship(
        "EventoPartidoEstudianteRendimiento", back_populates="partido", cascade="all, delete-orphan", lazy="selectin"
    )

    resultados_jugadores: Mapped[List["EventoPartidoResultadoJugador"]] = relationship(
        "EventoPartidoResultadoJugador", back_populates="partido", cascade="all, delete-orphan", lazy="selectin"
    )


class EventoPartidoEstudianteRendimiento(Base):
    __tablename__ = "evento_partido_estudiantes_rendimiento"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id_evento_partido: Mapped[int] = mapped_column(
        ForeignKey("eventos_partidos.id", ondelete="CASCADE"), nullable=False
    )
    id_estudiante: Mapped[int] = mapped_column(
        ForeignKey("estudiantes.id", ondelete="CASCADE"), nullable=False
    )

    # Roles (0 or 1)
    role_attacker: Mapped[int] = mapped_column(Integer, default=0)
    role_defender: Mapped[int] = mapped_column(Integer, default=0)
    role_keeper: Mapped[int] = mapped_column(Integer, default=0)
    role_midfielder: Mapped[int] = mapped_column(Integer, default=0)

    # Stats
    rating: Mapped[float] = mapped_column(Float, default=0.0)
    minutes_played: Mapped[int] = mapped_column(Integer, default=0)
    goals: Mapped[int] = mapped_column(Integer, default=0)
    assists: Mapped[int] = mapped_column(Integer, default=0)
    was_fouled: Mapped[int] = mapped_column(Integer, default=0)
    
    total_shots: Mapped[int] = mapped_column(Integer, default=0)
    shot_on_target: Mapped[int] = mapped_column(Integer, default=0)
    shot_off_target: Mapped[int] = mapped_column(Integer, default=0)
    blocked_shots: Mapped[int] = mapped_column(Integer, default=0)
    shot_accuracy: Mapped[float] = mapped_column(Float, default=0.0)
    chances_created: Mapped[int] = mapped_column(Integer, default=0)
    
    touches: Mapped[int] = mapped_column(Integer, default=0)
    pass_success: Mapped[float] = mapped_column(Float, default=0.0)
    key_passes: Mapped[int] = mapped_column(Integer, default=0)
    crosses: Mapped[int] = mapped_column(Integer, default=0)
    dribbles_succeeded: Mapped[int] = mapped_column(Integer, default=0)
    
    tackles_attempted: Mapped[int] = mapped_column(Integer, default=0)
    tackles_succeeded: Mapped[int] = mapped_column(Integer, default=0)
    interceptions: Mapped[int] = mapped_column(Integer, default=0)
    recoveries: Mapped[int] = mapped_column(Integer, default=0)
    duels_won: Mapped[int] = mapped_column(Integer, default=0)
    aerials_won: Mapped[int] = mapped_column(Integer, default=0)
    
    saves: Mapped[int] = mapped_column(Integer, default=0)
    saves_inside_box: Mapped[int] = mapped_column(Integer, default=0)
    diving_save: Mapped[int] = mapped_column(Integer, default=0)
    punches: Mapped[int] = mapped_column(Integer, default=0)
    throws: Mapped[int] = mapped_column(Integer, default=0)
    goals_conceded: Mapped[int] = mapped_column(Integer, default=0)
    
    mvp: Mapped[bool] = mapped_column(Boolean, default=False)
    
    partido: Mapped[EventoPartido] = relationship("EventoPartido", back_populates="performances")
    estudiante: Mapped["Estudiante"] = relationship("Estudiante", lazy="joined")


class EventoPartidoResultadoJugador(Base):
    __tablename__ = "evento_partido_resultados_jugadores"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    evento_partido_id: Mapped[int] = mapped_column(
        ForeignKey("eventos_partidos.id", ondelete="CASCADE"), nullable=False
    )
    estudiante_id: Mapped[int] = mapped_column(
        ForeignKey("estudiantes.id", ondelete="CASCADE"), nullable=False
    )

    goles: Mapped[int] = mapped_column(Integer, default=0)
    puntos: Mapped[int] = mapped_column(Integer, default=0)
    faltas: Mapped[int] = mapped_column(Integer, default=0)
    tarjetas_amarillas: Mapped[int] = mapped_column(Integer, default=0)
    tarjetas_rojas: Mapped[int] = mapped_column(Integer, default=0)

    creado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    actualizado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        server_onupdate=func.now(),
    )

    partido: Mapped[EventoPartido] = relationship("EventoPartido", back_populates="resultados_jugadores")
    estudiante: Mapped["Estudiante"] = relationship("Estudiante", lazy="joined")
