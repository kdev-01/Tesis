-- Gestión de recuperaciones, invitaciones y permisos
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id BIGSERIAL PRIMARY KEY,
  usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expiracion TIMESTAMPTZ NOT NULL,
  utilizado BOOLEAN NOT NULL DEFAULT FALSE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_usuario ON password_reset_tokens(usuario_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_valid ON password_reset_tokens(utilizado, expiracion);

CREATE TABLE IF NOT EXISTS user_invitations (
  id BIGSERIAL PRIMARY KEY,
  email CITEXT NOT NULL,
  nombre TEXT,
  rol_id BIGINT NOT NULL REFERENCES roles_sistema(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expira_en TIMESTAMPTZ NOT NULL,
  aceptado_en TIMESTAMPTZ,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_invitations_email ON user_invitations(email);
CREATE INDEX IF NOT EXISTS idx_user_invitations_valid ON user_invitations(expira_en, aceptado_en);

CREATE TABLE IF NOT EXISTS role_permissions (
  id BIGSERIAL PRIMARY KEY,
  rol_id BIGINT NOT NULL REFERENCES roles_sistema(id) ON DELETE CASCADE,
  permiso TEXT NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_role_permissions_role_perm ON role_permissions(rol_id, lower(permiso));

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS avatar_url TEXT;
