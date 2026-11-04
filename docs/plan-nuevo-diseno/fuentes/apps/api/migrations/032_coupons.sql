-- Cupones de descuento propios (no los de Stripe): la API calcula el importe, lo muestra antes de
-- pagar y Stripe cobra ese importe. Un cupón da un porcentaje o una cantidad, puede caducar y tener
-- un máximo de usos, y cada cuenta lo usa una vez. No se borran: se desactivan.
-- `coupon_redemptions` guarda los usos: mientras el pago está pendiente es una reserva, y si el pago
-- se cancela la fila se borra. El panel de administración escribe solo con las dos funciones de
-- abajo, que dejan registro en `admin_audit_log` (AGENTS.md §25); `admin_ro` sigue sin escribir tablas.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TABLE IF NOT EXISTS coupons (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9-]{3,}$'),
  percent_off bigint CHECK (percent_off BETWEEN 1 AND 100),
  amount_off_cents bigint CHECK (amount_off_cents BETWEEN 1 AND 100000),
  expires_at timestamptz,
  max_redemptions bigint CHECK (max_redemptions BETWEEN 1 AND 100000),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coupons_one_discount CHECK ((percent_off IS NULL) <> (amount_off_cents IS NULL))
);
ALTER TABLE coupons ADD CONSTRAINT coupons_code_max_length CHECK (char_length(code) <= 32);

CREATE TABLE IF NOT EXISTS coupon_redemptions (
  payment_id uuid PRIMARY KEY REFERENCES event_payments(id) ON DELETE CASCADE,
  coupon_id uuid NOT NULL REFERENCES coupons(id),
  -- Borrar la cuenta no borra el uso: cuenta para el máximo del cupón (y queda sin datos personales)
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  discount_cents bigint NOT NULL CHECK (discount_cents >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coupon_redemptions_once_per_account UNIQUE (coupon_id, user_id)
);

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  admin text NOT NULL CHECK (char_length(admin) <= 100),
  action text NOT NULL CHECK (char_length(action) <= 50),
  target text NOT NULL CHECK (char_length(target) <= 255),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE FUNCTION admin_create_coupon(
  p_code text, p_percent_off bigint, p_amount_off_cents bigint, p_expires_at timestamptz,
  p_max_redemptions bigint, p_admin text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  new_id uuid;
BEGIN
  INSERT INTO coupons(code, percent_off, amount_off_cents, expires_at, max_redemptions)
  VALUES (p_code, p_percent_off, p_amount_off_cents, p_expires_at, p_max_redemptions)
  RETURNING id INTO new_id;
  INSERT INTO admin_audit_log(admin, action, target) VALUES (p_admin, 'coupon.create', p_code);
  RETURN new_id;
END
$$;

CREATE FUNCTION admin_set_coupon_active(p_id uuid, p_active boolean, p_admin text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  changed text;
BEGIN
  UPDATE coupons SET active = p_active, updated_at = now() WHERE id = p_id RETURNING code INTO changed;
  IF changed IS NULL THEN
    RETURN false;
  END IF;
  INSERT INTO admin_audit_log(admin, action, target)
  VALUES (p_admin, CASE WHEN p_active THEN 'coupon.activate' ELSE 'coupon.deactivate' END, changed);
  RETURN true;
END
$$;

REVOKE ALL ON FUNCTION admin_create_coupon(text, bigint, bigint, timestamptz, bigint, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_set_coupon_active(uuid, boolean, text) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'admin_ro') THEN
    GRANT SELECT ON coupons TO admin_ro;
    GRANT SELECT (coupon_id, payment_id) ON coupon_redemptions TO admin_ro;
    GRANT SELECT (id, status) ON event_payments TO admin_ro;
    GRANT EXECUTE ON FUNCTION admin_create_coupon(text, bigint, bigint, timestamptz, bigint, text) TO admin_ro;
    GRANT EXECUTE ON FUNCTION admin_set_coupon_active(uuid, boolean, text) TO admin_ro;
  END IF;
END
$$;
