-- Registro de eventos de aplicación y mejoras en instituciones

-- Agregar columnas para eliminación lógica en instituciones
ALTER TABLE instituciones
    ADD COLUMN IF NOT EXISTS eliminado BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS eliminado_en TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS eliminado_por BIGINT REFERENCES usuarios(id);

-- Crear tabla de historial de eventos de aplicación
CREATE TABLE IF NOT EXISTS app_event_logs (
    id BIGSERIAL PRIMARY KEY,
    entidad TEXT NOT NULL,
    entidad_id BIGINT,
    accion TEXT NOT NULL,
    descripcion TEXT NOT NULL,
    severidad TEXT NOT NULL DEFAULT 'info',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    actor_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
    actor_nombre TEXT,
    registrado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_event_logs_entidad ON app_event_logs(entidad);
CREATE INDEX IF NOT EXISTS idx_app_event_logs_actor ON app_event_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_app_event_logs_registrado_en ON app_event_logs(registrado_en DESC);
