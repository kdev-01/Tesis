-- Datos adicionales para entornos de desarrollo y pruebas
-- Estudiantes, representantes educativos, instituciones, escenarios y eventos

-- Nuevas instituciones
INSERT INTO instituciones (nombre, descripcion, direccion, ciudad, email, telefono, estado)
VALUES
  ('Colegio Sierra Nevada', 'Institución con programas deportivos destacados', 'Av. Principal 123', 'Medellín', 'contacto@sierranevada.edu', '+57 3001111111', 'activo'),
  ('Unidad Educativa Horizonte', 'Participa activamente en torneos intercolegiales', 'Calle 45 #10', 'Quito', 'info@horizonte.edu.ec', '+593 980000001', 'activo')
ON CONFLICT (nombre) DO NOTHING;

-- Representantes educativos y asignación a instituciones
WITH rep_role AS (
  SELECT id FROM roles_sistema WHERE nombre = 'Representante educativo' LIMIT 1
),
rep1 AS (
  INSERT INTO usuarios (nombre_completo, email, telefono, activo, hash_password, creado_en, actualizado_en)
  VALUES ('Laura Gómez', 'laura.gomez@sierranevada.edu', '+57 3002222222', TRUE,
    '$argon2id$v=19$m=19456,t=2,p=2$fo9xznlPiXGOEYLwHoNQig$0iPAuDGYb2HZGjaRiaQa3AHryrTcSTrSBJ2UDAoaqFM', now(), now())
  ON CONFLICT (email) DO UPDATE SET telefono = EXCLUDED.telefono
  RETURNING id
),
rep2 AS (
  INSERT INTO usuarios (nombre_completo, email, telefono, activo, hash_password, creado_en, actualizado_en)
  VALUES ('Pedro Almeida', 'pedro.almeida@horizonte.edu.ec', '+593 980000002', TRUE,
    '$argon2id$v=19$m=19456,t=2,p=2$fo9xznlPiXGOEYLwHoNQig$0iPAuDGYb2HZGjaRiaQa3AHryrTcSTrSBJ2UDAoaqFM', now(), now())
  ON CONFLICT (email) DO UPDATE SET telefono = EXCLUDED.telefono
  RETURNING id
)
INSERT INTO usuarios_roles (usuario_id, rol_id)
SELECT rep.id, rep_role.id
FROM rep_role, (SELECT * FROM rep1 UNION ALL SELECT * FROM rep2) rep
ON CONFLICT (usuario_id, rol_id) DO NOTHING;

-- Vincular representantes a sus instituciones
INSERT INTO instituciones_miembros (institucion_id, usuario_id, rol_institucion)
SELECT inst.id, usr.id, 'encargado'
FROM (
  SELECT id, nombre FROM instituciones WHERE nombre IN ('Colegio Sierra Nevada', 'Unidad Educativa Horizonte')
) AS inst
JOIN usuarios AS usr ON (
  (inst.nombre = 'Colegio Sierra Nevada' AND usr.email = 'laura.gomez@sierranevada.edu') OR
  (inst.nombre = 'Unidad Educativa Horizonte' AND usr.email = 'pedro.almeida@horizonte.edu.ec')
)
ON CONFLICT (institucion_id, usuario_id) DO NOTHING;

-- Estudiantes adicionales
INSERT INTO estudiantes (institucion_id, nombres, apellidos, documento_identidad, fecha_nacimiento, genero, activo, creado_en, actualizado_en)
SELECT inst.id, datos.nombres, datos.apellidos, datos.documento_identidad, datos.fecha_nacimiento, datos.genero, TRUE, now(), now()
FROM (
  VALUES
    ('Colegio Sierra Nevada', 'Camila', 'Rodríguez', '11001100', '2007-03-14', 'F'),
    ('Colegio Sierra Nevada', 'Mateo', 'Vargas', '11002200', '2006-11-02', 'M'),
    ('Unidad Educativa Horizonte', 'Dayana', 'Mora', '22003300', '2008-07-21', 'F'),
    ('Unidad Educativa Horizonte', 'Javier', 'Quishpe', '22004400', '2007-01-09', 'M')
) AS datos(nombre_institucion, nombres, apellidos, documento_identidad, fecha_nacimiento, genero)
JOIN instituciones AS inst ON inst.nombre = datos.nombre_institucion
ON CONFLICT (institucion_id, documento_identidad) DO NOTHING;

-- Escenarios adicionales
INSERT INTO localizaciones (nombre, direccion, ciudad, capacidad, activo)
VALUES
  ('Polideportivo Central', 'Transversal 12 #34-56', 'Bogotá', 5000, TRUE),
  ('Coliseo del Norte', 'Av. de la Prensa y Calle 100', 'Quito', 3200, TRUE)
ON CONFLICT (nombre) DO NOTHING;

-- Eventos de ejemplo con cronograma completo
WITH admin_user AS (
  SELECT id FROM usuarios WHERE email = 'admin@agxport.com' LIMIT 1
),
football AS (
  SELECT id FROM deportes WHERE nombre = 'Fútbol' LIMIT 1
),
basket AS (
  SELECT id FROM deportes WHERE nombre = 'Baloncesto' LIMIT 1
),
cat_futbol AS (
  SELECT id FROM categorias_deportivas WHERE deporte_id = (SELECT id FROM football) ORDER BY id LIMIT 1
),
cat_basket AS (
  SELECT id FROM categorias_deportivas WHERE deporte_id = (SELECT id FROM basket) ORDER BY id LIMIT 1
)
INSERT INTO eventos (
  administrador_id,
  titulo,
  descripcion,
  estado,
  sexo_evento,
  deporte_id,
  fecha_inscripcion_inicio,
  fecha_inscripcion_fin,
  fecha_auditoria_inicio,
  fecha_auditoria_fin,
  fecha_campeonato_inicio,
  fecha_campeonato_fin,
  periodo_academico,
  documento_planeacion,
  eliminado,
  creado_en,
  actualizado_en
)
SELECT
  admin_user.id,
  event_data.titulo,
  event_data.descripcion,
  'borrador',
  event_data.sexo_evento,
  event_data.deporte_id,
  event_data.fecha_inscripcion_inicio,
  event_data.fecha_inscripcion_fin,
  event_data.fecha_auditoria_inicio,
  event_data.fecha_auditoria_fin,
  event_data.fecha_campeonato_inicio,
  event_data.fecha_campeonato_fin,
  extract(year FROM now())::TEXT,
  NULL,
  FALSE,
  now(),
  now()
FROM admin_user,
(
  VALUES
    ('Festival Escolar Sierra', 'Torneo relámpago para instituciones de la zona norte', 'M', (SELECT id FROM football), '2024-07-01', '2024-07-15', '2024-07-16', '2024-07-25', '2024-08-01', '2024-08-10'),
    ('Copa Horizonte', 'Campeonato amistoso de baloncesto intercolegial', 'MX', (SELECT id FROM basket), '2024-08-05', '2024-08-20', '2024-08-21', '2024-08-30', '2024-09-05', '2024-09-15')
) AS event_data(titulo, descripcion, sexo_evento, deporte_id, fecha_inscripcion_inicio, fecha_inscripcion_fin, fecha_auditoria_inicio, fecha_auditoria_fin, fecha_campeonato_inicio, fecha_campeonato_fin)
WHERE NOT EXISTS (
  SELECT 1 FROM eventos e WHERE e.titulo = event_data.titulo
);
