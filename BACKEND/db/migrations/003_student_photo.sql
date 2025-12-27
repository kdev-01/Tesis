-- Agrega columna para almacenar la foto de los estudiantes
ALTER TABLE IF EXISTS estudiantes
  ADD COLUMN IF NOT EXISTS foto_url TEXT;
