-- Agrega soporte para eliminación lógica de estudiantes
ALTER TABLE IF EXISTS estudiantes
    ADD COLUMN IF NOT EXISTS eliminado BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS eliminado_en TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS eliminado_por INTEGER NULL,
    ADD CONSTRAINT estudiantes_eliminado_por_fkey FOREIGN KEY (eliminado_por)
        REFERENCES usuarios(id)
        ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_estudiantes_eliminado ON estudiantes(eliminado);




ALTER TABLE app_event_logs
RENAME COLUMN metadata TO datos_extra;


ALTER TABLE app_event_logs
ALTER COLUMN datos_extra SET DEFAULT '{}'::jsonb;
