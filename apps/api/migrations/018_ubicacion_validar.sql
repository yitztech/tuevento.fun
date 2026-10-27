-- Valida la restricción que la 017 añadió con NOT VALID: los eventos antiguos no tienen punto.
-- LOCAL: solo dentro de la transacción de la migración, no en la conexión del pool
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
ALTER TABLE events VALIDATE CONSTRAINT events_geo_range;
