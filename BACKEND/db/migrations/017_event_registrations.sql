-- Event registration and auditing enhancements

ALTER TABLE evento_instituciones
    ADD COLUMN IF NOT EXISTS ultima_version_enviada_en TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS estado_auditoria VARCHAR(50) DEFAULT 'pendiente',
    ADD COLUMN IF NOT EXISTS motivo_rechazo TEXT,
    ADD COLUMN IF NOT EXISTS habilitado_campeonato BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS evento_institucion_reglas (
    id BIGSERIAL PRIMARY KEY,
    evento_institucion_id BIGINT NOT NULL REFERENCES evento_instituciones(id) ON DELETE CASCADE,
    min_participantes INT NOT NULL DEFAULT 0,
    max_participantes INT NOT NULL DEFAULT 0,
    observaciones TEXT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_evento_institucion_regla UNIQUE (evento_institucion_id)
);

CREATE TABLE IF NOT EXISTS evento_inscripciones (
    id BIGSERIAL PRIMARY KEY,
    evento_id BIGINT NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
    evento_institucion_id BIGINT NOT NULL REFERENCES evento_instituciones(id) ON DELETE CASCADE,
    categoria_id BIGINT NOT NULL REFERENCES categorias_deportivas(id) ON DELETE RESTRICT,
    nombre_equipo TEXT NOT NULL,
    aprobado BOOLEAN NOT NULL DEFAULT FALSE,
    bloqueado BOOLEAN NOT NULL DEFAULT FALSE,
    ultima_version_enviada_en TIMESTAMPTZ,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evento_inscripciones_evento ON evento_inscripciones (evento_id);
CREATE INDEX IF NOT EXISTS idx_evento_inscripciones_institucion ON evento_inscripciones (evento_institucion_id);
CREATE INDEX IF NOT EXISTS idx_evento_inscripciones_categoria ON evento_inscripciones (categoria_id);

CREATE TABLE IF NOT EXISTS evento_inscripcion_estudiantes (
    id BIGSERIAL PRIMARY KEY,
    inscripcion_id BIGINT NOT NULL REFERENCES evento_inscripciones(id) ON DELETE CASCADE,
    estudiante_id BIGINT NOT NULL REFERENCES estudiantes(id) ON DELETE RESTRICT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_inscripcion_estudiante UNIQUE (inscripcion_id, estudiante_id)
);

CREATE INDEX IF NOT EXISTS idx_evento_inscripcion_estudiantes_inscripcion ON evento_inscripcion_estudiantes (inscripcion_id);
CREATE INDEX IF NOT EXISTS idx_evento_inscripcion_estudiantes_estudiante ON evento_inscripcion_estudiantes (estudiante_id);

CREATE TABLE IF NOT EXISTS evento_auditorias (
    id BIGSERIAL PRIMARY KEY,
    evento_id BIGINT NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
    evento_institucion_id BIGINT NOT NULL REFERENCES evento_instituciones(id) ON DELETE CASCADE,
    accion VARCHAR(50) NOT NULL,
    motivo TEXT,
    actor_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
    registrado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evento_auditorias_evento ON evento_auditorias (evento_id);
CREATE INDEX IF NOT EXISTS idx_evento_auditorias_institucion ON evento_auditorias (evento_institucion_id);

CREATE TABLE IF NOT EXISTS eventos_partidos (
    id BIGSERIAL PRIMARY KEY,
    evento_id BIGINT NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    hora TIME NOT NULL,
    escenario_evento_id BIGINT REFERENCES evento_escenarios(id) ON DELETE SET NULL,
    categoria_id BIGINT REFERENCES categorias_deportivas(id) ON DELETE SET NULL,
    equipo_local_id BIGINT REFERENCES evento_inscripciones(id) ON DELETE SET NULL,
    equipo_visitante_id BIGINT REFERENCES evento_inscripciones(id) ON DELETE SET NULL,
    ronda VARCHAR(100),
    llave VARCHAR(100),
    observaciones TEXT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eventos_partidos_evento ON eventos_partidos (evento_id);
CREATE INDEX IF NOT EXISTS idx_eventos_partidos_fecha ON eventos_partidos (fecha);

COMMIT;
