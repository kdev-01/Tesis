-- Roles base
INSERT INTO roles_sistema (nombre, descripcion) VALUES
('Administrador','Gestiona todo el sistema'),
('Representante de comisión','Gestiona estudiantes y competiciones asignadas'),
('Representante educativo','Gestión interna de su institución educativa')
ON CONFLICT (nombre) DO NOTHING;

-- Usuario administrador
WITH admin_user AS (
  INSERT INTO usuarios (nombre_completo, email, telefono, activo, hash_password)
  VALUES (
    'Admin General',
    'admin@agxport.com',
    '+57 3010000000',
    TRUE,
    '$argon2id$v=19$m=19456,t=2,p=2$fo9xznlPiXGOEYLwHoNQig$0iPAuDGYb2HZGjaRiaQa3AHryrTcSTrSBJ2UDAoaqFM'
  )
  ON CONFLICT (email) DO UPDATE SET nombre_completo = EXCLUDED.nombre_completo
  RETURNING id
),
admin_role AS (
  SELECT id FROM roles_sistema WHERE nombre = 'Administrador'
)
INSERT INTO usuarios_roles (usuario_id, rol_id)
SELECT admin_user.id, admin_role.id FROM admin_user, admin_role
ON CONFLICT (usuario_id, rol_id) DO NOTHING;

UPDATE usuarios SET tipo_sangre = 'O+'
WHERE email = 'admin@agxport.com' AND (tipo_sangre IS DISTINCT FROM 'O+' OR tipo_sangre IS NULL);

-- Usuario entrenador
WITH coach_user AS (
  INSERT INTO usuarios (nombre_completo, email, telefono, activo, hash_password)
  VALUES (
    'Coach Rivera',
    'coach@agxport.com',
    '+57 3020000000',
    TRUE,
    '$argon2id$v=19$m=19456,t=2,p=2$V+r9f68VAoDwvlfqfQ/BeA$deyJfmmNdUJSft3ojlRDQub4mYiVaX5zMHoSwkqv+WY'
  )
  ON CONFLICT (email) DO UPDATE SET nombre_completo = EXCLUDED.nombre_completo
  RETURNING id
),
coach_role AS (
  SELECT id FROM roles_sistema WHERE nombre = 'Representante de comisión'
)
INSERT INTO usuarios_roles (usuario_id, rol_id)
SELECT coach_user.id, coach_role.id FROM coach_user, coach_role
ON CONFLICT (usuario_id, rol_id) DO NOTHING;

UPDATE usuarios SET tipo_sangre = 'A+'
WHERE email = 'coach@agxport.com' AND (tipo_sangre IS DISTINCT FROM 'A+' OR tipo_sangre IS NULL);

-- Instituciones de muestra
WITH inst1 AS (
  INSERT INTO instituciones (nombre, descripcion, direccion, ciudad, email, telefono, estado)
  VALUES ('Colegio Andino', 'Institución líder en deporte escolar', 'Cra 7 #123', 'Bogotá', 'contacto@andino.edu', '+57 1234567', 'activa')
  ON CONFLICT (nombre) DO UPDATE SET descripcion = EXCLUDED.descripcion
  RETURNING id
),
inst2 AS (
  INSERT INTO instituciones (nombre, descripcion, direccion, ciudad, email, telefono, estado)
  VALUES ('Instituto Pacífico', 'Formación integral con énfasis deportivo', 'Av 45 #67', 'Cali', 'info@pacifico.edu', '+57 7654321', 'activa')
  ON CONFLICT (nombre) DO UPDATE SET descripcion = EXCLUDED.descripcion
  RETURNING id
)
INSERT INTO instituciones_miembros (institucion_id, usuario_id, rol_institucion)
SELECT inst1.id, (SELECT id FROM usuarios WHERE email = 'coach@agxport.com'), 'entrenador'
FROM inst1
ON CONFLICT (institucion_id, usuario_id) DO NOTHING;

-- Localizaciones
INSERT INTO localizaciones (nombre, direccion, ciudad, capacidad, activo)
SELECT 'Estadio Metropolitano', 'Cll 50 #20', 'Barranquilla', 25000, TRUE
WHERE NOT EXISTS (SELECT 1 FROM localizaciones WHERE nombre = 'Estadio Metropolitano');

-- Catálogo de deportes y categorías
INSERT INTO deportes (nombre)
VALUES
  ('Fútbol'),
  ('Baloncesto'),
  ('Voleibol')
ON CONFLICT (nombre) DO NOTHING;

WITH futbol AS (
  SELECT id FROM deportes WHERE nombre = 'Fútbol'
)
INSERT INTO categorias_deportivas (deporte_id, nombre)
SELECT futbol.id, categoria
FROM futbol,
     (VALUES
        ('Inferior Damas'),
        ('Inferior Varones'),
        ('Intermedia Damas'),
        ('Intermedia Varones'),
        ('Superior Mixto')
     ) AS categorias(categoria)
ON CONFLICT (deporte_id, nombre) DO NOTHING;

WITH baloncesto AS (
  SELECT id FROM deportes WHERE nombre = 'Baloncesto'
)
INSERT INTO categorias_deportivas (deporte_id, nombre)
SELECT baloncesto.id, categoria
FROM baloncesto,
     (VALUES
        ('Juvenil Femenino'),
        ('Juvenil Masculino'),
        ('Mayores Mixto')
     ) AS categorias(categoria)
ON CONFLICT (deporte_id, nombre) DO NOTHING;

WITH voleibol AS (
  SELECT id FROM deportes WHERE nombre = 'Voleibol'
)
INSERT INTO categorias_deportivas (deporte_id, nombre)
SELECT voleibol.id, categoria
FROM voleibol,
     (VALUES
        ('Escolar Femenino'),
        ('Escolar Masculino'),
        ('Libre Mixto')
     ) AS categorias(categoria)
ON CONFLICT (deporte_id, nombre) DO NOTHING;
