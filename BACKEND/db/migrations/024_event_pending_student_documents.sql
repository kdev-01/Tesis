CREATE TABLE IF NOT EXISTS evento_inscripcion_documentos_pendientes (
    id SERIAL PRIMARY KEY,
    evento_institucion_id INTEGER NOT NULL REFERENCES evento_instituciones(id) ON DELETE CASCADE,
    estudiante_id INTEGER NOT NULL REFERENCES estudiantes(id) ON DELETE RESTRICT,
    tipo_documento VARCHAR(50) NOT NULL,
    archivo_url TEXT NOT NULL,
    subido_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_evento_documento_pendiente UNIQUE (evento_institucion_id, estudiante_id, tipo_documento)
);
