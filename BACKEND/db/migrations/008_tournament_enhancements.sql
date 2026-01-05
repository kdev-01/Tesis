ALTER TABLE eventos
    ADD COLUMN IF NOT EXISTS fecha_inicio_tentativa DATE,
    ADD COLUMN IF NOT EXISTS fecha_fin_tentativa DATE,
    ADD COLUMN IF NOT EXISTS documento_planeacion TEXT,
    ADD COLUMN IF NOT EXISTS imagen_portada TEXT,
    ADD COLUMN IF NOT EXISTS eliminado BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS evento_instituciones (
    id BIGSERIAL PRIMARY KEY,
    evento_id BIGINT NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
    institucion_id BIGINT NOT NULL REFERENCES instituciones(id) ON DELETE CASCADE,
    fecha_inscripcion_extendida DATE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (evento_id, institucion_id)
);
