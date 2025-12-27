ALTER TABLE localizaciones
    ADD COLUMN IF NOT EXISTS foto_url TEXT,
    ADD COLUMN IF NOT EXISTS disponibilidad JSONB,
    ADD COLUMN IF NOT EXISTS creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now();

-- ensure existing registros mark timestamps coherently
UPDATE localizaciones
SET creado_en = COALESCE(creado_en, now()),
    actualizado_en = COALESCE(actualizado_en, now())
WHERE TRUE;
