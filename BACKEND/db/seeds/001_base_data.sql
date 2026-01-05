-- Roles base
INSERT INTO roles_sistema (nombre, descripcion) VALUES
('Administrador','Gestiona y administra todas las funcionalidades del sistema.'),
('Representante de comisión','Gestiona los estudiantes y las competiciones que le han sido asignadas.'),
('Representante educativo','Gestiona la información y los procesos internos de su institución educativa.')
ON CONFLICT (nombre) DO NOTHING;

-- Usuario administrador
WITH admin_user AS (
  INSERT INTO usuarios (nombre_completo, email, telefono, activo, hash_password)
  VALUES (
    'Root',
    'root@fedenapo.com',
    '0996678152',
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
WHERE email = 'root@fedenapo.com' AND (tipo_sangre IS DISTINCT FROM 'O+' OR tipo_sangre IS NULL);

-- Instituciones de muestra
INSERT INTO instituciones (
  nombre,
  descripcion,
  direccion,
  ciudad,
  email,
  telefono,
  estado
)
VALUES
('E.E.B. Marquez de Selva Alegre', 'Institución educativa registrada en el sistema.', 'Av. 1', 'Arosemena', 'marquezdeselvaalegre@educacion.edu.ec', '0912345678', 'activa'),
('U.E. San Francisco Javier', 'Institución educativa registrada en el sistema.', 'Av. 2', 'Tena', 'sanfranciscojavier@educacion.edu.ec', '0912345679', 'activa'),
('U.E. Maximiliano Spiller', 'Institución educativa registrada en el sistema.', 'Av. 3', 'Tena', 'maximilianospiller@educacion.edu.ec', '0912345680', 'activa'),
('U.E. Juan XXIII', 'Institución educativa registrada en el sistema.', 'Av. 4', 'Tena', 'juanxxiii@educacion.edu.ec', '0912345681', 'activa'),
('U.E. Nacional Tena', 'Institución educativa registrada en el sistema.', 'Av. 5', 'Tena', 'nacionaltena@educacion.edu.ec', '0912345682', 'activa'),
('U.E. Bilingüe Pano', 'Institución educativa registrada en el sistema.', 'Av. 6', 'Tena', 'bilinguepano@educacion.edu.ec', '0912345683', 'activa'),
('U.E. Ciudad de Tena', 'Institución educativa registrada en el sistema.', 'Av. 7', 'Tena', 'ciudaddetena@educacion.edu.ec', '0912345684', 'activa'),
('U.E. Jose Pelaez', 'Institución educativa registrada en el sistema.', 'Av. 8', 'Tena', 'josepelaez@educacion.edu.ec', '0912345685', 'activa'),
('U.E. San Jose', 'Institución educativa registrada en el sistema.', 'Av. 9', 'Tena', 'sanjose@educacion.edu.ec', '0912345686', 'activa'),
('U.E. Hermano Miguel', 'Institución educativa registrada en el sistema.', 'Av. 10', 'Tena', 'hermanomiguel@educacion.edu.ec', '0912345687', 'activa'),
('U.E. Emilio Cecco', 'Institución educativa registrada en el sistema.', 'Av. 11', 'Tena', 'emiliocecco@educacion.edu.ec', '0912345688', 'activa'),
('U.E. Misahualli', 'Institución educativa registrada en el sistema.', 'Av. 12', 'Tena', 'misahualli@educacion.edu.ec', '0912345689', 'activa'),
('U.E. Patriota Michilena', 'Institución educativa registrada en el sistema.', 'Av. 13', 'Tena', 'patriotamichilena@educacion.edu.ec', '0912345690', 'activa'),
('U.E. Guillermo Kadle', 'Institución educativa registrada en el sistema.', 'Av. 14', 'Tena', 'guillermokadle@educacion.edu.ec', '0912345691', 'activa'),
('U.E. Carlos Tomas Rivadeneyra', 'Institución educativa registrada en el sistema.', 'Av. 15', 'Tena', 'carlostomasrivadeneyra@educacion.edu.ec', '0912345692', 'activa'),
('U.E. Ahuano', 'Institución educativa registrada en el sistema.', 'Av. 16', 'Tena', 'ahuano@educacion.edu.ec', '0912345693', 'activa'),
('U.E. Intillacta de Paushiyacu', 'Institución educativa registrada en el sistema.', 'Av. 17', 'Tena', 'intillactapaushiyacu@educacion.edu.ec', '0912345694', 'activa'),
('U.E. Juan Tanca Marengo', 'Institución educativa registrada en el sistema.', 'Av. 18', 'Tena', 'juantancamarengo@educacion.edu.ec', '0912345695', 'activa'),
('U.E. Ottorino Todescato', 'Institución educativa registrada en el sistema.', 'Av. 19', 'Tena', 'ottorinotodescato@educacion.edu.ec', '0912345696', 'activa'),
('U.E. Nicolas Shiguango', 'Institución educativa registrada en el sistema.', 'Av. 20', 'Tena', 'nicolasshiguango@educacion.edu.ec', '0912345697', 'activa'),
('U.E. Eloy Baquero Lugo', 'Institución educativa registrada en el sistema.', 'Av. 21', 'Tena', 'eloybaquerolugo@educacion.edu.ec', '0912345698', 'activa'),
('U.E.P. Antioquia', 'Institución educativa registrada en el sistema.', 'Av. 22', 'Tena', 'antioquia@educacion.edu.ec', '0912345699', 'activa'),
('U.E. Aldelmo Rodriguez', 'Institución educativa registrada en el sistema.', 'Av. 23', 'Tena', 'aldelmorodriguez@educacion.edu.ec', '0912345700', 'activa'),
('U.E. Elicio Olalla', 'Institución educativa registrada en el sistema.', 'Av. 24', 'Tena', 'elicioolalla@educacion.edu.ec', '0912345701', 'activa'),
('U.E. Ernesto Ophuls', 'Institución educativa registrada en el sistema.', 'Av. 25', 'Tena', 'ernestoophuls@educacion.edu.ec', '0912345702', 'activa'),
('E.E.B. Eloy Alfaro', 'Institución educativa registrada en el sistema.', 'Av. 26', 'Tena', 'eloyalfaro@educacion.edu.ec', '0912345703', 'activa'),
('E.E.B. Paulino Grefa', 'Institución educativa registrada en el sistema.', 'Av. 27', 'Tena', 'paulinogrefa@educacion.edu.ec', '0912345704', 'activa'),
('E.E.B. Miguel Iturralde', 'Institución educativa registrada en el sistema.', 'Av. 28', 'Archidona', 'migueliturralde@educacion.edu.ec', '0912345705', 'activa'),
('U.E. Jaime Roldos Aguilera', 'Institución educativa registrada en el sistema.', 'Av. 29', 'Archidona', 'jaimeroldos@educacion.edu.ec', '0912345706', 'activa'),
('U.E. Maria Inmaculada', 'Institución educativa registrada en el sistema.', 'Av. 30', 'Archidona', 'mariainmaculada@educacion.edu.ec', '0912345707', 'activa'),
('U.E. Leonardo Murialdo', 'Institución educativa registrada en el sistema.', 'Av. 31', 'Archidona', 'leonardomurialdo@educacion.edu.ec', '0912345708', 'activa'),
('U.E. Archidona', 'Institución educativa registrada en el sistema.', 'Av. 32', 'Archidona', 'archidona@educacion.edu.ec', '0912345709', 'activa'),
('U.E. El Chaco', 'Institución educativa registrada en el sistema.', 'Av. 33', 'El Chaco', 'elchaco@educacion.edu.ec', '0912345710', 'activa'),
('U.E. Santa Rosa', 'Institución educativa registrada en el sistema.', 'Av. 34', 'El Chaco', 'santarosa@educacion.edu.ec', '0912345711', 'activa'),
('E.E.B. Napo', 'Institución educativa registrada en el sistema.', 'Av. 35', 'El Chaco', 'napo@educacion.edu.ec', '0912345712', 'activa'),
('U.E. Enrique Avelino Silva', 'Institución educativa registrada en el sistema.', 'Av. 36', 'El Chaco', 'enriqueavelinosilva@educacion.edu.ec', '0912345713', 'activa'),
('U.E. Juan Bautista Monitni', 'Institución educativa registrada en el sistema.', 'Av. 37', 'Quijos', 'juanbautistamonitni@educacion.edu.ec', '0912345714', 'activa'),
('U.E. Baeza', 'Institución educativa registrada en el sistema.', 'Av. 38', 'Quijos', 'baeza@educacion.edu.ec', '0912345715', 'activa'),
('E.E.B. General Quis Quis', 'Institución educativa registrada en el sistema.', 'Av. 39', 'Quijos', 'generalquisquis@educacion.edu.ec', '0912345716', 'activa'),
('E.E.B. Guillermo Vinueza', 'Institución educativa registrada en el sistema.', 'Av. 40', 'Quijos', 'guillermovinueza@educacion.edu.ec', '0912345717', 'activa')
ON CONFLICT (nombre) DO UPDATE
SET descripcion = EXCLUDED.descripcion;

-- Localizaciones
INSERT INTO localizaciones (nombre, direccion, ciudad, capacidad, activo)
VALUES
-- Arosemena
('Estadio Arosemena Norte', 'Av. Principal Norte', 'Arosemena', 3000, TRUE),
('Cancha Municipal Arosemena', 'Barrio Central', 'Arosemena', 1500, TRUE),
('Complejo Deportivo Selva Alegre', 'Vía Rural Selva Alegre', 'Arosemena', 2000, TRUE),

-- Tena
('Estadio de Tena', 'Av. 15 de Noviembre', 'Tena', 8000, TRUE),
('Complejo Deportivo Amazonas', 'Barrio Amazonas', 'Tena', 3500, TRUE),
('Cancha Barrial El Dorado', 'Barrio El Dorado', 'Tena', 1200, TRUE),

-- Archidona
('Estadio Municipal Archidona', 'Av. Circunvalación', 'Archidona', 5000, TRUE),
('Cancha San Pablo de Ushpayacu', 'Sector San Pablo', 'Archidona', 1800, TRUE),
('Complejo Deportivo Archidona Norte', 'Vía Archidona–Tena', 'Archidona', 2500, TRUE),

-- El Chaco
('Estadio Municipal El Chaco', 'Av. Quito', 'El Chaco', 4500, TRUE),
('Cancha Barrio Central El Chaco', 'Barrio Central', 'El Chaco', 1300, TRUE),
('Complejo Deportivo El Chaco Sur', 'Sector Sur', 'El Chaco', 2200, TRUE),

-- Quijos
('Estadio Municipal Quijos', 'Av. Interoceánica', 'Quijos', 4000, TRUE),
('Cancha Comunitaria Baeza', 'Barrio La Merced', 'Quijos', 1600, TRUE),
('Complejo Deportivo Río Quijos', 'Sector Río Quijos', 'Quijos', 2800, TRUE);

-- Catálogo de deportes y categorías
INSERT INTO deportes (nombre)
VALUES
  ('Fútbol'),
  ('Baloncesto'),
  ('Futsal')
ON CONFLICT (nombre) DO NOTHING;

WITH futbol AS (
  SELECT id FROM deportes WHERE nombre = 'Fútbol'
)
INSERT INTO categorias_deportivas (deporte_id, nombre)
SELECT futbol.id, categoria
FROM futbol,
     (VALUES
        ('Pre-Infantil'),
        ('Infantil'),
        ('Inferior'),
        ('Intermedio'),
        ('Superior')
     ) AS categorias(categoria)
ON CONFLICT (deporte_id, nombre) DO NOTHING;

WITH baloncesto AS (
  SELECT id FROM deportes WHERE nombre = 'Baloncesto'
)
INSERT INTO categorias_deportivas (deporte_id, nombre)
SELECT baloncesto.id, categoria
FROM baloncesto,
     (VALUES
        ('Pre-Infantil'),
        ('Infantil'),
        ('Inferior'),
        ('Intermedio'),
        ('Superior')
     ) AS categorias(categoria)
ON CONFLICT (deporte_id, nombre) DO NOTHING;

WITH futsal AS (
  SELECT id FROM deportes WHERE nombre = 'Futsal'
)
INSERT INTO categorias_deportivas (deporte_id, nombre)
SELECT futsal.id, categoria
FROM futsal,
     (VALUES
        ('Pre-Infantil'),
        ('Infantil'),
        ('Inferior'),
        ('Intermedio'),
        ('Superior')
     ) AS categorias(categoria)
ON CONFLICT (deporte_id, nombre) DO NOTHING;
