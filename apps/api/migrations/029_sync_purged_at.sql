-- Cuándo se purgaron por última vez los tombstones de la cuenta (migración 028). Un cursor solo
-- caduca si es anterior a la purga en número y en fecha: los de una descarga completa que empezó
-- después de la purga siguen valiendo aunque su número sea menor (no necesitan lo purgado).
-- Columna nueva sin valor por defecto: sin reescribir la tabla.
-- LOCAL: solo dentro de la transacción de la migración, no en la conexión del pool
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE sync_clock ADD COLUMN IF NOT EXISTS purged_at timestamptz;
