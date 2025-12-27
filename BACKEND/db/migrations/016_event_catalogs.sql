-- Create sports catalog
CREATE TABLE IF NOT EXISTS deportes (
    id BIGSERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL UNIQUE,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create sports categories catalog
CREATE TABLE IF NOT EXISTS categorias_deportivas (
    id BIGSERIAL PRIMARY KEY,
    deporte_id BIGINT NOT NULL REFERENCES deportes(id) ON DELETE CASCADE,
    nombre VARCHAR(255) NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_categoria_deporte_nombre UNIQUE (deporte_id, nombre)
);

-- Update events table structure
ALTER TABLE eventos
    ADD COLUMN IF NOT EXISTS sexo_evento VARCHAR(2) NOT NULL DEFAULT 'MX',
    ADD COLUMN IF NOT EXISTS deporte_id BIGINT,
    DROP COLUMN IF EXISTS disciplina,
    DROP COLUMN IF EXISTS fecha_inicio,
    DROP COLUMN IF EXISTS fecha_fin,
    DROP COLUMN IF EXISTS limite_equipos,
    DROP COLUMN IF EXISTS minimo_por_equipo,
    DROP COLUMN IF EXISTS maximo_por_equipo;

-- Rename tentative date columns to championship dates if they exist
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'eventos'
          AND column_name = 'fecha_inicio_tentativa'
    ) THEN
        ALTER TABLE eventos RENAME COLUMN fecha_inicio_tentativa TO fecha_campeonato_inicio;
    ELSE
        ALTER TABLE eventos ADD COLUMN IF NOT EXISTS fecha_campeonato_inicio DATE;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'eventos'
          AND column_name = 'fecha_fin_tentativa'
    ) THEN
        ALTER TABLE eventos RENAME COLUMN fecha_fin_tentativa TO fecha_campeonato_fin;
    ELSE
        ALTER TABLE eventos ADD COLUMN IF NOT EXISTS fecha_campeonato_fin DATE;
    END IF;
END $$;

-- Ensure deporte_id references deportes and existing rows are populated
DO $$
DECLARE
    default_sport_id BIGINT;
BEGIN
    INSERT INTO deportes (nombre)
    VALUES ('Por definir')
    ON CONFLICT (nombre) DO NOTHING;

    SELECT id INTO default_sport_id FROM deportes WHERE nombre = 'Por definir';

    UPDATE eventos SET deporte_id = default_sport_id WHERE deporte_id IS NULL;
    UPDATE eventos SET sexo_evento = 'MX' WHERE sexo_evento IS NULL;

    ALTER TABLE eventos
        ALTER COLUMN deporte_id SET NOT NULL,
        ADD CONSTRAINT fk_evento_deporte FOREIGN KEY (deporte_id) REFERENCES deportes(id) ON DELETE RESTRICT,
        ALTER COLUMN sexo_evento SET NOT NULL;
END $$;

-- Add invitation status to event institutions
ALTER TABLE evento_instituciones
    ADD COLUMN IF NOT EXISTS estado_invitacion VARCHAR(50) NOT NULL DEFAULT 'pendiente';

-- Create relation tables for categories and scenarios
CREATE TABLE IF NOT EXISTS evento_categorias (
    evento_id BIGINT NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
    categoria_id BIGINT NOT NULL REFERENCES categorias_deportivas(id) ON DELETE CASCADE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_evento_categoria UNIQUE (evento_id, categoria_id)
);

CREATE TABLE IF NOT EXISTS evento_escenarios (
    id BIGSERIAL PRIMARY KEY,
    evento_id BIGINT NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
    escenario_id BIGINT REFERENCES localizaciones(id) ON DELETE SET NULL,
    nombre_escenario VARCHAR(255) NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Remove legacy discipline tables
DROP TABLE IF EXISTS evento_disciplinas;
DROP TABLE IF EXISTS disciplinas;
