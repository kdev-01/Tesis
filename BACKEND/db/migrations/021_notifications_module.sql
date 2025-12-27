CREATE TABLE IF NOT EXISTS notificaciones (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    titulo VARCHAR(200) NOT NULL,
    mensaje TEXT,
    tipo VARCHAR(50) NOT NULL DEFAULT 'general',
    nivel VARCHAR(20) NOT NULL DEFAULT 'info',
    metadata JSONB,
    evento_id INTEGER REFERENCES eventos(id) ON DELETE SET NULL,
    leido BOOLEAN NOT NULL DEFAULT FALSE,
    leido_en TIMESTAMPTZ,
    eliminado BOOLEAN NOT NULL DEFAULT FALSE,
    eliminado_en TIMESTAMPTZ,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario
    ON notificaciones (usuario_id)
    WHERE eliminado IS FALSE;

CREATE INDEX IF NOT EXISTS idx_notificaciones_unread
    ON notificaciones (usuario_id)
    WHERE eliminado IS FALSE AND leido IS FALSE;
