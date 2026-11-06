-- Registro en dos pasos: confirmar el correo y después elegir el tipo de cuenta. Las dos marcas
-- nacen en false, así que las cuentas que ya existen quedan exentas; solo las cuentas nuevas las
-- activan al registrarse. Se añade el tipo «agency» (agencia organizadora de eventos).
-- LOCAL: solo dentro de la transacción de la migración, no en la conexión del pool
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- Con un valor por defecto constante, PostgreSQL no reescribe la tabla
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_verify_email boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_choose_type boolean NOT NULL DEFAULT false;

ALTER TABLE users DROP CONSTRAINT users_account_type_check;
-- NOT VALID: la 041 la valida
ALTER TABLE users ADD CONSTRAINT users_account_type_check CHECK (account_type IN ('organizer', 'provider', 'agency')) NOT VALID;
