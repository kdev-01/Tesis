-- Registra el tipo de sangre para los usuarios del sistema
ALTER TABLE IF EXISTS usuarios
  ADD COLUMN IF NOT EXISTS tipo_sangre TEXT CHECK (tipo_sangre IN ('A+','A-','B+','B-','AB+','AB-','O+','O-'));
