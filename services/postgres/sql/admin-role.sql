-- Rol de solo lectura del panel de administración (servicio `admin`).
-- Solo ve las columnas que muestra el panel: nunca password_hash, token_hash ni teléfonos.
-- Uso: psql -v ON_ERROR_STOP=1 -v admin_pw='…' -v db=tueventofun -f admin-role.sql (como el dueño, tuevento).
-- Es seguro repetirlo: crea el rol si falta (si no, solo cambia su contraseña) y deja sus permisos
-- exactamente en esta lista. Nunca borra el rol, porque con permisos concedidos DROP ROLE falla.
-- psql no sustituye variables dentro de $$…$$: la contraseña pasa al bloque por una opción de la sesión.
SELECT set_config('panel.pw', :'admin_pw', false);
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'admin_ro') THEN
    CREATE ROLE admin_ro;
  END IF;
  EXECUTE format('ALTER ROLE admin_ro WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD %L', current_setting('panel.pw'));
END
$$;
SELECT set_config('panel.pw', '', false);
GRANT CONNECT ON DATABASE :"db" TO admin_ro;
GRANT USAGE ON SCHEMA public TO admin_ro;
-- Quitar en las tablas también quita los permisos por columna: lo que salga de esta lista deja de verse
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM admin_ro;
GRANT SELECT (id, first_name, last_name, email, registration_platform, created_at, is_demo) ON users TO admin_ro;
GRANT SELECT (expires_at) ON sessions TO admin_ro;
GRANT SELECT ON activity TO admin_ro;
GRANT SELECT ON events TO admin_ro;
GRANT SELECT (id, event_id) ON invitations TO admin_ro;
GRANT SELECT (invitation_id, status) ON members TO admin_ro;
