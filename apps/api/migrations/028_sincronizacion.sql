-- Sincronización de las apps sin conexión (docs/PLAN-PROVEEDORES-Y-OFFLINE.md, fase 8a).
--
-- - Reloj de cambios por cuenta (sync_clock): cada alta, cambio o borrado de un dato de la cuenta
--   toma el siguiente número. GET /api/sync/changes devuelve lo que tiene un número mayor que el
--   del cursor. La fila del reloj se bloquea hasta el final de la transacción, así que los números
--   de una cuenta se confirman en orden: una página nunca deja un hueco que se llene después.
-- - version y updated_at en events, invitations y members (y version en el perfil y los servicios
--   del proveedor), al día por triggers: If-Match compara con version.
-- - Las personas de una invitación viajan dentro de ella, y los servicios, fotos y categorías
--   dentro del perfil: su cambio solo «toca» a su padre (le da un número nuevo sin cambiar su
--   versión), para que el organizador no reciba un conflicto porque un invitado respondió.
-- - sync_tombstones: lo borrado, para que el teléfono también lo borre. Un evento borrado deja
--   también las de sus invitaciones y avisos (se borran en cascada). Se purgan a los 90 días.
-- - idempotency_keys: la respuesta de cada escritura con Idempotency-Key, 24 horas.
--
-- Columnas nuevas con DEFAULT constante: sin reescribir las tablas. Los números de las filas que
-- ya existen se asignan aquí, antes de crear los triggers (las tablas son pequeñas).
-- LOCAL: solo dentro de la transacción de la migración, no en la conexión del pool
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TABLE IF NOT EXISTS sync_clock (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  seq bigint NOT NULL DEFAULT 0,
  -- Mayor número de un tombstone ya purgado: un cursor anterior caduca (410)
  purged_seq bigint NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sync_tombstones (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seq bigint NOT NULL,
  entity text NOT NULL CHECK (entity IN ('event', 'invitation', 'notification', 'provider')),
  entity_id uuid NOT NULL,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, seq)
);
CREATE INDEX IF NOT EXISTS sync_tombstones_deleted_idx ON sync_tombstones(deleted_at);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key uuid NOT NULL,
  method text NOT NULL CHECK (char_length(method) <= 10),
  path text NOT NULL CHECK (char_length(path) <= 2048),
  -- sha256 del cuerpo: la misma clave con otro cuerpo es un error del cliente (422)
  body_hash text NOT NULL CHECK (char_length(body_hash) <= 64),
  -- NULL mientras la primera petición está en curso
  status bigint CHECK (status BETWEEN 100 AND 599),
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);
CREATE INDEX IF NOT EXISTS idempotency_keys_created_idx ON idempotency_keys(created_at);

ALTER TABLE events ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 1;
ALTER TABLE events ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE events ADD COLUMN IF NOT EXISTS sync_seq bigint NOT NULL DEFAULT 0;
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 1;
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS sync_seq bigint NOT NULL DEFAULT 0;
ALTER TABLE members ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 1;
ALTER TABLE members ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS sync_seq bigint NOT NULL DEFAULT 0;
ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 1;
ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS sync_seq bigint NOT NULL DEFAULT 0;
ALTER TABLE provider_services ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 1;

-- Números de lo que ya existe: únicos en toda la base, y por tanto en cada cuenta. El perfil de
-- proveedor se queda en 0 (hay uno por cuenta y no tiene eventos con los que empatar).
UPDATE events e SET sync_seq = n.rn
  FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM events) n WHERE e.id = n.id;
UPDATE invitations i SET sync_seq = n.rn + (SELECT count(*) FROM events)
  FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM invitations) n WHERE i.id = n.id;
UPDATE notifications t SET sync_seq = n.rn + (SELECT count(*) FROM events) + (SELECT count(*) FROM invitations)
  FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM notifications) n WHERE t.id = n.id;
INSERT INTO sync_clock(user_id, seq)
  SELECT id, (SELECT count(*) FROM events) + (SELECT count(*) FROM invitations) + (SELECT count(*) FROM notifications)
  FROM users
ON CONFLICT (user_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS events_sync_idx ON events(user_id, sync_seq);
CREATE INDEX IF NOT EXISTS notifications_sync_idx ON notifications(user_id, sync_seq);

-- Siguiente número de la cuenta. NULL si la cuenta no existe (se está borrando en cascada); al
-- escribir, COALESCE(…, 0) deja que la clave foránea dé su propio error.
CREATE OR REPLACE FUNCTION sync_next(owner uuid) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE
  next_seq bigint;
BEGIN
  IF owner IS NULL THEN
    RETURN NULL;
  END IF;
  INSERT INTO sync_clock AS c (user_id, seq)
    SELECT owner, 1 WHERE EXISTS (SELECT 1 FROM users WHERE id = owner)
  ON CONFLICT (user_id) DO UPDATE SET seq = c.seq + 1
  RETURNING seq INTO next_seq;
  RETURN next_seq;
END $$;

CREATE OR REPLACE FUNCTION sync_tombstone(owner uuid, kind text, id uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  next_seq bigint := sync_next(owner);
BEGIN
  IF next_seq IS NOT NULL THEN
    INSERT INTO sync_tombstones(user_id, seq, entity, entity_id) VALUES (owner, next_seq, kind, id);
  END IF;
END $$;

-- Eventos: todo cambio toma número; la versión solo sube si cambia lo que edita el organizador
-- (los intentos fallidos de la contraseña pública no le provocan un conflicto).
CREATE OR REPLACE FUNCTION events_sync() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.sync_seq := COALESCE(sync_next(NEW.user_id), 0);
  IF TG_OP = 'UPDATE' THEN
    IF (NEW.title, NEW.description, NEW.date, NEW.time_zone, NEW.location, NEW.latitude, NEW.longitude,
        NEW.theme, NEW.archived, NEW.cancelled, NEW.slug, NEW.public_password_hash)
       IS DISTINCT FROM
       (OLD.title, OLD.description, OLD.date, OLD.time_zone, OLD.location, OLD.latitude, OLD.longitude,
        OLD.theme, OLD.archived, OLD.cancelled, OLD.slug, OLD.public_password_hash) THEN
      NEW.version := OLD.version + 1;
      NEW.updated_at := now();
    ELSE
      NEW.version := OLD.version;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER events_sync BEFORE INSERT OR UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION events_sync();

CREATE OR REPLACE FUNCTION events_tombstones() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  r record;
BEGIN
  PERFORM sync_tombstone(OLD.user_id, 'event', OLD.id);
  FOR r IN SELECT id FROM invitations WHERE event_id = OLD.id LOOP
    PERFORM sync_tombstone(OLD.user_id, 'invitation', r.id);
  END LOOP;
  FOR r IN SELECT id FROM notifications WHERE event_id = OLD.id LOOP
    PERFORM sync_tombstone(OLD.user_id, 'notification', r.id);
  END LOOP;
  RETURN OLD;
END $$;
CREATE TRIGGER events_tombstones BEFORE DELETE ON events
  FOR EACH ROW EXECUTE FUNCTION events_tombstones();

-- Invitaciones: escribir sync_seq a mano es el «toque» de una persona (solo número nuevo)
CREATE OR REPLACE FUNCTION invitations_sync() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.sync_seq IS DISTINCT FROM OLD.sync_seq THEN
    RETURN NEW;
  END IF;
  NEW.sync_seq := COALESCE(sync_next((SELECT user_id FROM events WHERE id = NEW.event_id)), 0);
  IF TG_OP = 'UPDATE' THEN
    NEW.version := OLD.version + 1;
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER invitations_sync BEFORE INSERT OR UPDATE ON invitations
  FOR EACH ROW EXECUTE FUNCTION invitations_sync();

-- Borrada sola (no con su evento, que ya dejó la suya): tombstone
CREATE OR REPLACE FUNCTION invitations_tombstone() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM sync_tombstone(e.user_id, 'invitation', OLD.id) FROM events e WHERE e.id = OLD.event_id;
  RETURN OLD;
END $$;
CREATE TRIGGER invitations_tombstone AFTER DELETE ON invitations
  FOR EACH ROW EXECUTE FUNCTION invitations_tombstone();

CREATE OR REPLACE FUNCTION members_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.version := OLD.version + 1;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER members_version BEFORE UPDATE ON members
  FOR EACH ROW EXECUTE FUNCTION members_version();

CREATE OR REPLACE FUNCTION members_touch_invitation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  parent uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.invitation_id ELSE NEW.invitation_id END;
BEGIN
  UPDATE invitations i SET sync_seq = COALESCE(sync_next(e.user_id), 0)
    FROM events e WHERE i.id = parent AND e.id = i.event_id;
  RETURN NULL;
END $$;
CREATE TRIGGER members_touch_invitation AFTER INSERT OR UPDATE OR DELETE ON members
  FOR EACH ROW EXECUTE FUNCTION members_touch_invitation();

CREATE OR REPLACE FUNCTION notifications_sync() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.sync_seq := COALESCE(sync_next(NEW.user_id), 0);
  RETURN NEW;
END $$;
CREATE TRIGGER notifications_sync BEFORE INSERT OR UPDATE ON notifications
  FOR EACH ROW EXECUTE FUNCTION notifications_sync();

-- Borrado solo (no con su evento): tombstone
CREATE OR REPLACE FUNCTION notifications_tombstone() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM events WHERE id = OLD.event_id) THEN
    PERFORM sync_tombstone(OLD.user_id, 'notification', OLD.id);
  END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER notifications_tombstone AFTER DELETE ON notifications
  FOR EACH ROW EXECUTE FUNCTION notifications_tombstone();

-- Perfil de proveedor: igual que las invitaciones, con servicios, fotos y categorías dentro
CREATE OR REPLACE FUNCTION provider_profiles_sync() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.sync_seq IS DISTINCT FROM OLD.sync_seq THEN
    RETURN NEW;
  END IF;
  NEW.sync_seq := COALESCE(sync_next(NEW.user_id), 0);
  IF TG_OP = 'UPDATE' THEN
    NEW.version := OLD.version + 1;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER provider_profiles_sync BEFORE INSERT OR UPDATE ON provider_profiles
  FOR EACH ROW EXECUTE FUNCTION provider_profiles_sync();

CREATE OR REPLACE FUNCTION provider_profiles_tombstone() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM sync_tombstone(OLD.user_id, 'provider', OLD.id);
  RETURN OLD;
END $$;
CREATE TRIGGER provider_profiles_tombstone BEFORE DELETE ON provider_profiles
  FOR EACH ROW EXECUTE FUNCTION provider_profiles_tombstone();

CREATE OR REPLACE FUNCTION provider_services_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.version := OLD.version + 1;
  RETURN NEW;
END $$;
CREATE TRIGGER provider_services_version BEFORE UPDATE ON provider_services
  FOR EACH ROW EXECUTE FUNCTION provider_services_version();

CREATE OR REPLACE FUNCTION provider_touch_profile() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  parent uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.provider_id ELSE NEW.provider_id END;
BEGIN
  UPDATE provider_profiles SET sync_seq = COALESCE(sync_next(user_id), 0) WHERE id = parent;
  RETURN NULL;
END $$;
CREATE TRIGGER provider_services_touch AFTER INSERT OR UPDATE OR DELETE ON provider_services
  FOR EACH ROW EXECUTE FUNCTION provider_touch_profile();
CREATE TRIGGER provider_images_touch AFTER INSERT OR UPDATE OR DELETE ON provider_images
  FOR EACH ROW EXECUTE FUNCTION provider_touch_profile();
CREATE TRIGGER provider_categories_touch AFTER INSERT OR UPDATE OR DELETE ON provider_categories
  FOR EACH ROW EXECUTE FUNCTION provider_touch_profile();
