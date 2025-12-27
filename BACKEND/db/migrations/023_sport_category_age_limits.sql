ALTER TABLE categorias_deportivas
    ADD COLUMN IF NOT EXISTS edad_minima INTEGER,
    ADD COLUMN IF NOT EXISTS edad_maxima INTEGER;

ALTER TABLE categorias_deportivas
    DROP CONSTRAINT IF EXISTS ck_categoria_rango_edades;

ALTER TABLE categorias_deportivas
    ADD CONSTRAINT ck_categoria_rango_edades
        CHECK (edad_minima IS NULL OR edad_maxima IS NULL OR edad_minima <= edad_maxima);

ALTER TABLE evento_inscripciones ALTER COLUMN categoria_id DROP NOT NULL;
