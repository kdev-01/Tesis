-- Event schedule automation enhancements

ALTER TABLE eventos_partidos
    ADD COLUMN IF NOT EXISTS fase VARCHAR(50),
    ADD COLUMN IF NOT EXISTS serie VARCHAR(50),
    ADD COLUMN IF NOT EXISTS hora_fin TIME,
    ADD COLUMN IF NOT EXISTS estado VARCHAR(30) DEFAULT 'programado',
    ADD COLUMN IF NOT EXISTS placeholder_local TEXT,
    ADD COLUMN IF NOT EXISTS placeholder_visitante TEXT;

CREATE TABLE IF NOT EXISTS evento_config (
    evento_id BIGINT PRIMARY KEY REFERENCES eventos(id) ON DELETE CASCADE,
    hora_inicio TIME NOT NULL DEFAULT TIME '08:00',
    hora_fin TIME NOT NULL DEFAULT TIME '18:00',
    duracion_horas INT NOT NULL DEFAULT 1,
    descanso_min_dias INT NOT NULL DEFAULT 0,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMIT;
