BEGIN;

ALTER TABLE usuarios
    ADD COLUMN IF NOT EXISTS eliminado BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS institucion_id INTEGER REFERENCES instituciones(id) ON DELETE SET NULL;

-- Ensure logical deletion defaults for existing records
UPDATE usuarios SET eliminado = COALESCE(eliminado, FALSE);

-- Enforce single role per user
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'uq_usuarios_roles_usuario'
    ) THEN
        ALTER TABLE usuarios_roles
            ADD CONSTRAINT uq_usuarios_roles_usuario UNIQUE (usuario_id);
    END IF;
END $$;

-- Remove deprecated commission assignments
DROP TABLE IF EXISTS commission_sports;

-- Rename roles to the new terminology
UPDATE roles_sistema
SET nombre = 'Representante de comisión', descripcion = 'Gestiona estudiantes y competiciones asignadas'
WHERE nombre = 'Entrenador';

UPDATE roles_sistema
SET nombre = 'Representante educativo', descripcion = 'Gestiona la información de su institución educativa'
WHERE nombre = 'Encargado';

-- Remove obsolete permission entries
DELETE FROM role_permissions WHERE LOWER(permiso) = 'assign_sport';

COMMIT;
