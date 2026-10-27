-- Valida las restricciones que la 015 añadió con NOT VALID: los datos antiguos ya cumplen.
-- LOCAL: solo dentro de la transacción de la migración, no en la conexión del pool
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
ALTER TABLE users VALIDATE CONSTRAINT users_public_code_format;
ALTER TABLE events VALIDATE CONSTRAINT events_slug_present;
ALTER TABLE event_access VALIDATE CONSTRAINT event_access_invitation_id_fkey;
