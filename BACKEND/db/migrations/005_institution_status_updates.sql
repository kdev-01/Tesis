ALTER TABLE instituciones
    ADD COLUMN IF NOT EXISTS motivo_desafiliacion TEXT,
    ADD COLUMN IF NOT EXISTS fecha_desafiliacion TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS fecha_reafiliacion TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS sancion_motivo TEXT,
    ADD COLUMN IF NOT EXISTS sancion_tipo TEXT,
    ADD COLUMN IF NOT EXISTS sancion_inicio TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS sancion_fin TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS sancion_activa BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE instituciones
    DROP CONSTRAINT IF EXISTS instituciones_estado_check;

ALTER TABLE instituciones
    ADD CONSTRAINT instituciones_estado_check
    CHECK (estado IN ('activa','inactiva','desafiliada','sancionada'));

UPDATE instituciones SET estado = 'activa' WHERE estado = 'activo';
UPDATE instituciones SET estado = 'inactiva' WHERE estado = 'inactivo';
UPDATE instituciones SET estado = 'sancionada' WHERE estado = 'sancionado';
