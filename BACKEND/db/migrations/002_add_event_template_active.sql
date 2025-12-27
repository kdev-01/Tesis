ALTER TABLE plantillas_evento
ADD COLUMN IF NOT EXISTS activa BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_plantillas_activa ON plantillas_evento (activa);
