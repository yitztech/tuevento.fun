-- Registro con Google: Google no da el teléfono, así que la cuenta nueva lo pide justo después de
-- registrarse (paso de onboarding, como elegir el tipo). La marca nace en false: las cuentas que ya
-- existen quedan exentas y solo las cuentas nuevas de Google la activan.
-- LOCAL: solo dentro de la transacción de la migración, no en la conexión del pool
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- Con un valor por defecto constante, PostgreSQL no reescribe la tabla
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_add_phone boolean NOT NULL DEFAULT false;
