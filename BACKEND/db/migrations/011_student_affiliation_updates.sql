-- Permite desvincular estudiantes de una institución sin eliminarlos
ALTER TABLE IF EXISTS estudiantes
    DROP CONSTRAINT IF EXISTS estudiantes_institucion_id_fkey;

ALTER TABLE IF EXISTS estudiantes
    ALTER COLUMN institucion_id DROP NOT NULL;

ALTER TABLE IF EXISTS estudiantes
    ADD CONSTRAINT estudiantes_institucion_id_fkey
        FOREIGN KEY (institucion_id)
        REFERENCES instituciones(id)
        ON DELETE SET NULL;
