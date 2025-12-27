ALTER TABLE eventos
    DROP CONSTRAINT IF EXISTS eventos_plantilla_id_fkey;

ALTER TABLE eventos
    DROP COLUMN IF EXISTS plantilla_id,
    DROP COLUMN IF EXISTS condiciones,
    DROP COLUMN IF EXISTS localizacion_id;

ALTER TABLE eventos
    RENAME COLUMN deporte TO disciplina;

ALTER TABLE eventos
    DROP CONSTRAINT IF EXISTS eventos_periodo_deporte_unique;

ALTER TABLE eventos
    ADD CONSTRAINT eventos_periodo_disciplina_unique UNIQUE (periodo_academico, disciplina)
    DEFERRABLE INITIALLY IMMEDIATE;

DROP INDEX IF EXISTS idx_plantillas_activa;
DROP INDEX IF EXISTS idx_plantillas_nombre;

DROP TABLE IF EXISTS plantilla_fases;
DROP TABLE IF EXISTS plantilla_reglas;
DROP TABLE IF EXISTS plantilla_categorias_edad;
DROP TABLE IF EXISTS plantillas_evento;
