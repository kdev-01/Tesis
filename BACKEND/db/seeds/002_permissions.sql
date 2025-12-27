WITH role_map AS (
  SELECT id, nombre FROM roles_sistema
)
INSERT INTO role_permissions (rol_id, permiso)
SELECT role_map.id,
       permiso
FROM role_map
JOIN LATERAL (
  VALUES
    ('Administrador', 'manage_users'),
    ('Administrador', 'manage_roles'),
    ('Administrador', 'manage_permissions'),
    ('Administrador', 'manage_events'),
    ('Administrador', 'view_events'),
    ('Administrador', 'manage_institutions'),
    ('Administrador', 'view_institutions'),
    ('Administrador', 'manage_students'),
    ('Administrador', 'view_students'),
    ('Representante de comisión', 'manage_users'),
    ('Representante de comisión', 'manage_roles'),
    ('Representante de comisión', 'manage_permissions'),
    ('Representante de comisión', 'manage_events'),
    ('Representante de comisión', 'view_events'),
    ('Representante de comisión', 'manage_institutions'),
    ('Representante de comisión', 'view_institutions'),
    ('Representante de comisión', 'manage_students'),
    ('Representante de comisión', 'view_students'),
    ('Representante educativo', 'view_institutions'),
    ('Representante educativo', 'manage_institutions'),
    ('Representante educativo', 'view_events')
) AS perms(role_name, permiso)
  ON role_map.nombre = perms.role_name
ON CONFLICT (rol_id, lower(permiso)) DO NOTHING;

