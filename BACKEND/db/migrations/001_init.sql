-- =========================================================
--  APLICACIÓN: GESTIÓN DE EVENTOS DEPORTIVOS
--  Base de datos: PostgreSQL
--  Idioma: Español
--  Objetivos:
--   - Usuarios con roles del sistema (Administrador, Representante de comisión, Representante educativo).
--   - Instituciones, estudiantes, localizaciones.
--   - Banco de plantillas de eventos (categorías, reglas, fases).
--   - Instancias de evento (copias editables), inscripciones, verificación.
--   - Representantes asignados por institución; gestionan sus estudiantes y eventos.
--   - Formato torneo (grupos, encuentros, clasificaciones).
--   - Premios / historial.
--   - Vistas útiles + triggers de integridad.
--   - (Opcional) Políticas RLS compatibles con Supabase.
-- =========================================================

CREATE EXTENSION IF NOT EXISTS citext;       -- emails case-insensitive
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- ===========================
-- Catálogo de roles del sistema
-- ===========================
CREATE TABLE IF NOT EXISTS roles_sistema (
  id BIGSERIAL PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,                -- 'Administrador','Representante de comisión','Representante educativo'
  descripcion TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===========================
-- Usuarios del sistema
-- ===========================
CREATE TABLE IF NOT EXISTS usuarios (
  id BIGSERIAL PRIMARY KEY,
  nombre_completo TEXT NOT NULL,
  email CITEXT NOT NULL UNIQUE,
  telefono TEXT,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  hash_password TEXT,                         -- si gestionas auth interna
  ultimo_acceso TIMESTAMPTZ,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Relación N:N usuarios-roles
CREATE TABLE IF NOT EXISTS usuarios_roles (
  usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  rol_id BIGINT NOT NULL REFERENCES roles_sistema(id) ON DELETE RESTRICT,
  PRIMARY KEY (usuario_id, rol_id)
);

-- ===========================
-- Instituciones educativas
-- ===========================
CREATE TABLE IF NOT EXISTS instituciones (
  id BIGSERIAL PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  descripcion TEXT,
  direccion TEXT,
  ciudad TEXT,
  email CITEXT,
  telefono TEXT,
  portada_url TEXT,
  estado TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo','inactivo','sancionado')),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ENUM rol interno dentro de la institución
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rol_en_institucion') THEN
    CREATE TYPE rol_en_institucion AS ENUM ('encargado','entrenador','coordinador','otro');
  END IF;
END $$;

-- Vinculación de usuarios a instituciones (coach pertenece aquí)
CREATE TABLE IF NOT EXISTS instituciones_miembros (
  id BIGSERIAL PRIMARY KEY,
  institucion_id BIGINT NOT NULL REFERENCES instituciones(id) ON DELETE CASCADE,
  usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  rol_institucion rol_en_institucion NOT NULL DEFAULT 'encargado',
  UNIQUE (institucion_id, usuario_id)
);

-- ===========================
-- Estudiantes (pertenecen a una institución)
-- ===========================
CREATE TABLE IF NOT EXISTS estudiantes (
  id BIGSERIAL PRIMARY KEY,
  institucion_id BIGINT NOT NULL REFERENCES instituciones(id) ON DELETE CASCADE,
  nombres TEXT NOT NULL,
  apellidos TEXT NOT NULL,
  documento_identidad TEXT,
  foto_url TEXT,
  fecha_nacimiento DATE NOT NULL,
  genero TEXT CHECK (genero IN ('M','F','Otro')),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (institucion_id, documento_identidad)
);

-- ===========================
-- Localizaciones (sedes/canchas/ciudades)
-- ===========================
CREATE TABLE IF NOT EXISTS localizaciones (
  id BIGSERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  direccion TEXT,
  ciudad TEXT,
  lat NUMERIC(9,6),
  lon NUMERIC(9,6),
  capacidad INTEGER,
  activo BOOLEAN NOT NULL DEFAULT TRUE
);

-- =========================================================
-- BANCO DE PLANTILLAS DE EVENTO (reutilizables)
-- =========================================================
CREATE TABLE IF NOT EXISTS plantillas_evento (
  id BIGSERIAL PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,                 -- "Intercolegial Fútbol 2025"
  descripcion TEXT,
  limite_equipos INTEGER,
  minimo_por_equipo INTEGER,
  maximo_por_equipo INTEGER,
  deporte TEXT,                                -- opcional: 'futbol','basquet', etc.
  condiciones JSONB,                           -- reglas libres: vestimenta, docs, etc.
  creado_por BIGINT REFERENCES usuarios(id),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plantilla_categorias_edad (
  id BIGSERIAL PRIMARY KEY,
  plantilla_id BIGINT NOT NULL REFERENCES plantillas_evento(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,                        -- "Sub-12"
  edad_min INTEGER,
  edad_max INTEGER,
  UNIQUE (plantilla_id, nombre)
);

CREATE TABLE IF NOT EXISTS plantilla_reglas (
  id BIGSERIAL PRIMARY KEY,
  plantilla_id BIGINT NOT NULL REFERENCES plantillas_evento(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  detalle TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS plantilla_fases (
  id BIGSERIAL PRIMARY KEY,
  plantilla_id BIGINT NOT NULL REFERENCES plantillas_evento(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,                        -- "Grupos","Semifinal", etc.
  orden INTEGER NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'eliminatoria',   -- 'grupos','eliminatoria','liguilla', etc.
  UNIQUE (plantilla_id, nombre),
  UNIQUE (plantilla_id, orden)
);

-- =========================================================
-- EVENTOS (instancias basadas en plantillas)
-- =========================================================
CREATE TABLE IF NOT EXISTS eventos (
  id BIGSERIAL PRIMARY KEY,
  plantilla_id BIGINT REFERENCES plantillas_evento(id) ON DELETE SET NULL,
  administrador_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  localizacion_id BIGINT REFERENCES localizaciones(id),
  titulo TEXT NOT NULL,
  descripcion TEXT,
  deporte TEXT,                                -- copia de plantilla o específico
  estado TEXT NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador','publicado','en_curso','finalizado','archivado')),
  fecha_inscripcion_inicio DATE,
  fecha_inscripcion_fin DATE,
  fecha_inicio DATE,
  fecha_fin DATE,
  limite_equipos INTEGER,
  minimo_por_equipo INTEGER,
  maximo_por_equipo INTEGER,
  condiciones JSONB,                           -- copia editable de la plantilla
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS evento_categorias_edad (
  id BIGSERIAL PRIMARY KEY,
  evento_id BIGINT NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  edad_min INTEGER,
  edad_max INTEGER,
  UNIQUE (evento_id, nombre)
);

CREATE TABLE IF NOT EXISTS evento_reglas (
  id BIGSERIAL PRIMARY KEY,
  evento_id BIGINT NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  detalle TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS evento_fases (
  id BIGSERIAL PRIMARY KEY,
  evento_id BIGINT NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  orden INTEGER NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'eliminatoria',
  UNIQUE (evento_id, nombre),
  UNIQUE (evento_id, orden)
);

-- =========================================================
-- INSCRIPCIONES + ENTRENADOR (pertenece a la misma institución)
-- =========================================================
CREATE TABLE IF NOT EXISTS inscripciones (
  id BIGSERIAL PRIMARY KEY,
  evento_id BIGINT NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  institucion_id BIGINT NOT NULL REFERENCES instituciones(id) ON DELETE CASCADE,
  entrenador_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,       -- usuario
  miembro_entrenador_id BIGINT,                                          -- vinculación interna
  categoria_id BIGINT REFERENCES evento_categorias_edad(id) ON DELETE SET NULL,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','aceptada','rechazada','cancelada')),
  observaciones TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (evento_id, institucion_id, categoria_id)
);

ALTER TABLE inscripciones
  ADD CONSTRAINT fk_insc_miembro_entrenador
  FOREIGN KEY (miembro_entrenador_id)
  REFERENCES instituciones_miembros(id)
  ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION sync_y_valida_entrenador_inscripcion()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_rol rol_en_institucion;
BEGIN
  IF NEW.entrenador_id IS NULL THEN
    NEW.miembro_entrenador_id := NULL;
    RETURN NEW;
  END IF;

  SELECT im.id, im.rol_institucion
    INTO NEW.miembro_entrenador_id, v_rol
  FROM instituciones_miembros im
  WHERE im.usuario_id = NEW.entrenador_id
    AND im.institucion_id = NEW.institucion_id
  LIMIT 1;

  IF NEW.miembro_entrenador_id IS NULL THEN
    RAISE EXCEPTION 'El entrenador (%) no pertenece a la institución (%) de la inscripción',
      NEW.entrenador_id, NEW.institucion_id;
  END IF;

  IF v_rol <> 'entrenador' THEN
    RAISE EXCEPTION 'El usuario asignado no tiene rol de entrenador en la institución';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_valida_entrenador_insc ON inscripciones;
CREATE TRIGGER trg_sync_valida_entrenador_insc
BEFORE INSERT OR UPDATE OF entrenador_id, institucion_id
ON inscripciones
FOR EACH ROW EXECUTE FUNCTION sync_y_valida_entrenador_inscripcion();

-- Historial de estados (auditoría)
CREATE TABLE IF NOT EXISTS inscripciones_historial (
  id BIGSERIAL PRIMARY KEY,
  inscripcion_id BIGINT NOT NULL REFERENCES inscripciones(id) ON DELETE CASCADE,
  estado TEXT NOT NULL CHECK (estado IN ('pendiente','aceptada','rechazada','cancelada')),
  motivo TEXT,
  cambiado_por BIGINT REFERENCES usuarios(id),
  cambiado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Equipos por inscripción (una institución puede presentar varios equipos por categoría)
CREATE TABLE IF NOT EXISTS equipos (
  id BIGSERIAL PRIMARY KEY,
  inscripcion_id BIGINT NOT NULL REFERENCES inscripciones(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,                         -- "Colegio X Sub-14 A"
  UNIQUE (inscripcion_id, nombre)
);

-- Miembros de equipo (estudiantes)
CREATE TABLE IF NOT EXISTS equipos_miembros (
  id BIGSERIAL PRIMARY KEY,
  equipo_id BIGINT NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
  estudiante_id BIGINT NOT NULL REFERENCES estudiantes(id) ON DELETE RESTRICT,
  UNIQUE (equipo_id, estudiante_id)
);

-- Validaciones de requisitos por inscripción/equipo (documentos, apto médico, etc.)
CREATE TABLE IF NOT EXISTS verificaciones (
  id BIGSERIAL PRIMARY KEY,
  inscripcion_id BIGINT REFERENCES inscripciones(id) ON DELETE CASCADE,
  equipo_id BIGINT REFERENCES equipos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,                            -- 'documento_identidad','apto_medico', etc.
  resultado TEXT NOT NULL CHECK (resultado IN ('aprobado','observado','rechazado')),
  detalle TEXT,
  verificado_por BIGINT REFERENCES usuarios(id),
  verificado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((inscripcion_id IS NOT NULL) OR (equipo_id IS NOT NULL))
);

-- =========================================================
-- FORMATO TORNEO: Grupos, encuentros, clasificaciones
-- =========================================================
CREATE TABLE IF NOT EXISTS evento_grupos (
  id BIGSERIAL PRIMARY KEY,
  evento_id BIGINT NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  fase_id BIGINT NOT NULL REFERENCES evento_fases(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,                         -- "Grupo A"
  UNIQUE (fase_id, nombre)
);

CREATE TABLE IF NOT EXISTS evento_grupos_equipos (
  id BIGSERIAL PRIMARY KEY,
  grupo_id BIGINT NOT NULL REFERENCES evento_grupos(id) ON DELETE CASCADE,
  equipo_id BIGINT NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
  UNIQUE (grupo_id, equipo_id)
);

CREATE TABLE IF NOT EXISTS encuentros (
  id BIGSERIAL PRIMARY KEY,
  evento_id BIGINT NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  fase_id BIGINT NOT NULL REFERENCES evento_fases(id) ON DELETE CASCADE,
  grupo_id BIGINT REFERENCES evento_grupos(id) ON DELETE SET NULL,
  localizacion_id BIGINT REFERENCES localizaciones(id) ON DELETE SET NULL,
  fecha_hora TIMESTAMPTZ,
  equipo_local_id BIGINT NOT NULL REFERENCES equipos(id) ON DELETE RESTRICT,
  equipo_visitante_id BIGINT NOT NULL REFERENCES equipos(id) ON DELETE RESTRICT,
  estado TEXT NOT NULL DEFAULT 'programado' CHECK (estado IN ('programado','en_juego','finalizado','suspendido')),
  goles_local INTEGER DEFAULT 0 CHECK (goles_local >= 0),
  goles_visitante INTEGER DEFAULT 0 CHECK (goles_visitante >= 0),
  detalle JSONB
);

CREATE TABLE IF NOT EXISTS clasificaciones (
  id BIGSERIAL PRIMARY KEY,
  grupo_id BIGINT REFERENCES evento_grupos(id) ON DELETE CASCADE,
  fase_id BIGINT NOT NULL REFERENCES evento_fases(id) ON DELETE CASCADE,
  equipo_id BIGINT NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
  pj INTEGER NOT NULL DEFAULT 0,
  pg INTEGER NOT NULL DEFAULT 0,
  pe INTEGER NOT NULL DEFAULT 0,
  pp INTEGER NOT NULL DEFAULT 0,
  gf INTEGER NOT NULL DEFAULT 0,
  gc INTEGER NOT NULL DEFAULT 0,
  pts INTEGER NOT NULL DEFAULT 0,
  UNIQUE (fase_id, equipo_id),
  UNIQUE (grupo_id, equipo_id)
);

-- =========================================================
-- PREMIOS / HISTORIAL
-- =========================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_destinatario_premio') THEN
    CREATE TYPE tipo_destinatario_premio AS ENUM ('equipo','estudiante','institucion');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS premios (
  id BIGSERIAL PRIMARY KEY,
  evento_id BIGINT NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  fase_id BIGINT REFERENCES evento_fases(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,                          -- "Campeón", "Goleador", "Fair Play"
  descripcion TEXT,
  tipo_destinatario tipo_destinatario_premio NOT NULL,
  equipo_id BIGINT REFERENCES equipos(id) ON DELETE SET NULL,
  estudiante_id BIGINT REFERENCES estudiantes(id) ON DELETE SET NULL,
  institucion_id BIGINT REFERENCES instituciones(id) ON DELETE SET NULL,
  otorgado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (tipo_destinatario='equipo' AND equipo_id IS NOT NULL AND estudiante_id IS NULL AND institucion_id IS NULL) OR
    (tipo_destinatario='estudiante' AND estudiante_id IS NOT NULL AND equipo_id IS NULL AND institucion_id IS NULL) OR
    (tipo_destinatario='institucion' AND institucion_id IS NOT NULL AND equipo_id IS NULL AND estudiante_id IS NULL)
  )
);

-- =========================================================
-- ÍNDICES recomendados
-- =========================================================
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios (email);
CREATE INDEX IF NOT EXISTS idx_instituciones_estado ON instituciones (estado);
CREATE INDEX IF NOT EXISTS idx_estudiantes_inst_nac ON estudiantes (institucion_id, fecha_nacimiento);
CREATE INDEX IF NOT EXISTS idx_plantillas_nombre ON plantillas_evento (nombre);
CREATE INDEX IF NOT EXISTS idx_eventos_estado_fechas ON eventos (estado, fecha_inicio, fecha_fin);
CREATE INDEX IF NOT EXISTS idx_inscripciones_ev_inst_est ON inscripciones (evento_id, institucion_id, estado);
CREATE INDEX IF NOT EXISTS idx_evento_fases_orden ON evento_fases (evento_id, orden);
CREATE INDEX IF NOT EXISTS idx_encuentros_ev_fase_fecha ON encuentros (evento_id, fase_id, fecha_hora);
CREATE INDEX IF NOT EXISTS idx_premios_evento_tipo ON premios (evento_id, tipo_destinatario);

-- =========================================================
-- TRIGGERS de timestamp (actualizado_en)
-- =========================================================
CREATE OR REPLACE FUNCTION set_actualizado_en()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.actualizado_en = now();
  RETURN NEW;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ts_usuarios'
  ) THEN
    CREATE TRIGGER trg_ts_roles       BEFORE UPDATE ON roles_sistema     FOR EACH ROW EXECUTE FUNCTION set_actualizado_en();
    CREATE TRIGGER trg_ts_usuarios    BEFORE UPDATE ON usuarios          FOR EACH ROW EXECUTE FUNCTION set_actualizado_en();
    CREATE TRIGGER trg_ts_insts       BEFORE UPDATE ON instituciones     FOR EACH ROW EXECUTE FUNCTION set_actualizado_en();
    CREATE TRIGGER trg_ts_plantillas  BEFORE UPDATE ON plantillas_evento FOR EACH ROW EXECUTE FUNCTION set_actualizado_en();
    CREATE TRIGGER trg_ts_eventos     BEFORE UPDATE ON eventos           FOR EACH ROW EXECUTE FUNCTION set_actualizado_en();
    CREATE TRIGGER trg_ts_insc        BEFORE UPDATE ON inscripciones     FOR EACH ROW EXECUTE FUNCTION set_actualizado_en();
  END IF;
END $$;

-- =========================================================
-- CONFIGURACIÓN APLICACIÓN
-- =========================================================
CREATE TABLE IF NOT EXISTS app_settings (
  id BIGSERIAL PRIMARY KEY,
  branding_name TEXT NOT NULL,
  support_email CITEXT NOT NULL,
  maintenance_mode BOOLEAN NOT NULL DEFAULT FALSE
);
