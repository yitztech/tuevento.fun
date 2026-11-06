SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- La paleta global solo se cambia desde el panel de administración: `admin_ro` no escribe tablas, así
-- que lo hace con esta función, que deja registro (AGENTS.md §25), igual que los cupones (migración 032).
CREATE FUNCTION admin_set_site_palette(p_palette text, p_admin text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE site_palette_settings SET palette = p_palette, updated_at = now() WHERE singleton = true;
  INSERT INTO admin_audit_log(admin, action, target) VALUES (p_admin, 'site_palette.update', p_palette);
END
$$;

REVOKE ALL ON FUNCTION admin_set_site_palette(text, text) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'admin_ro') THEN
    GRANT SELECT (palette) ON site_palette_settings TO admin_ro;
    GRANT EXECUTE ON FUNCTION admin_set_site_palette(text, text) TO admin_ro;
  END IF;
END
$$;
