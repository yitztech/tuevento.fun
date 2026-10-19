-- Permisos de solo lectura para el rol del panel de administración (admin_ro).
-- Se aplica con la API (dueña de las tablas). Si el rol aún no existe (base de pruebas,
-- entorno sin panel), no hace nada; el rol se crea en services/postgres/initdb/01-admin-role.sh.
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'admin_ro') THEN
    GRANT USAGE ON SCHEMA public TO admin_ro;
    GRANT SELECT (id, first_name, last_name, email, registration_platform, created_at, is_demo) ON users TO admin_ro;
    GRANT SELECT (expires_at) ON sessions TO admin_ro;
    GRANT SELECT ON activity TO admin_ro;
    GRANT SELECT ON events TO admin_ro;
    GRANT SELECT (id, event_id) ON invitations TO admin_ro;
    GRANT SELECT (invitation_id, status) ON members TO admin_ro;
  END IF;
END
$$;
