-- Rol de solo lectura del panel de administración (servicio `admin`).
-- Solo ve las columnas que muestra el panel: nunca password_hash, token_hash ni teléfonos.
-- Uso: psql -v admin_pw='…' -v db=tueventofun -f admin-role.sql (como el dueño, tuevento).
-- Es seguro repetirlo: recrea el rol y sus permisos con la contraseña nueva.
DROP ROLE IF EXISTS admin_ro;
CREATE ROLE admin_ro LOGIN PASSWORD :'admin_pw';
GRANT CONNECT ON DATABASE :"db" TO admin_ro;
GRANT USAGE ON SCHEMA public TO admin_ro;
GRANT SELECT (id, first_name, last_name, email, registration_platform, created_at, is_demo) ON users TO admin_ro;
GRANT SELECT (expires_at) ON sessions TO admin_ro;
GRANT SELECT ON activity TO admin_ro;
GRANT SELECT ON events TO admin_ro;
GRANT SELECT (id, event_id) ON invitations TO admin_ro;
GRANT SELECT (invitation_id, status) ON members TO admin_ro;
