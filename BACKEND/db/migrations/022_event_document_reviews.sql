ALTER TABLE evento_inscripcion_estudiante_documentos
    ADD COLUMN IF NOT EXISTS estado_revision VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    ADD COLUMN IF NOT EXISTS observaciones_revision TEXT,
    ADD COLUMN IF NOT EXISTS revisado_por_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS revisado_en TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_evento_doc_revisado_por
    ON evento_inscripcion_estudiante_documentos (revisado_por_id)
    WHERE revisado_por_id IS NOT NULL;
