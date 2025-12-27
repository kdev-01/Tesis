-- Agrega columnas para resultados y llaves de avance en los partidos
ALTER TABLE eventos_partidos
    ADD COLUMN IF NOT EXISTS puntaje_local integer,
    ADD COLUMN IF NOT EXISTS puntaje_visitante integer,
    ADD COLUMN IF NOT EXISTS criterio_resultado varchar(50),
    ADD COLUMN IF NOT EXISTS ganador_inscripcion_id integer REFERENCES evento_inscripciones(id) ON DELETE SET NULL;

-- Asegura índice para las llaves y placeholders usados en el avance automático
CREATE INDEX IF NOT EXISTS ix_eventos_partidos_llave ON eventos_partidos(llave);
CREATE INDEX IF NOT EXISTS ix_eventos_partidos_placeholders ON eventos_partidos(placeholder_local, placeholder_visitante);
