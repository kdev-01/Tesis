BEGIN;

ALTER TABLE usuarios
    ADD COLUMN IF NOT EXISTS deporte_id INTEGER REFERENCES deportes(id) ON DELETE SET NULL;

-- Ensure single role representatives have a sport assigned manually afterwards if needed
CREATE INDEX IF NOT EXISTS ix_usuarios_deporte_id ON usuarios(deporte_id);

COMMIT;
