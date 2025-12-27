ALTER TABLE eventos
    ADD COLUMN IF NOT EXISTS periodo_academico TEXT;

UPDATE eventos
SET periodo_academico = COALESCE(periodo_academico, TO_CHAR(COALESCE(fecha_inicio, CURRENT_DATE), 'YYYY'));

ALTER TABLE eventos
    ADD CONSTRAINT eventos_periodo_deporte_unique UNIQUE (periodo_academico, deporte)
    DEFERRABLE INITIALLY IMMEDIATE;
