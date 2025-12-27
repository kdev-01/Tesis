CREATE TABLE IF NOT EXISTS evento_inscripcion_estudiante_documentos (
    id SERIAL PRIMARY KEY,
    estudiante_inscripcion_id INTEGER NOT NULL REFERENCES evento_inscripcion_estudiantes(id) ON DELETE CASCADE,
    tipo_documento VARCHAR(50) NOT NULL,
    archivo_url TEXT NOT NULL,
    subido_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_estudiante_documento_tipo
    ON evento_inscripcion_estudiante_documentos (estudiante_inscripcion_id, LOWER(tipo_documento));
