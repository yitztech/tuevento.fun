-- Tipo de cuenta, fijo desde el registro: quien organiza eventos o quien ofrece servicios para
-- ellos (docs/PLAN-PROVEEDORES-Y-OFFLINE.md, fase 2). Las cuentas que ya existen organizan eventos.
-- LOCAL: solo dentro de la transacción de la migración, no en la conexión del pool
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- Con un valor por defecto constante, PostgreSQL no reescribe la tabla
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'organizer';
-- NOT VALID: la 020 la valida
ALTER TABLE users ADD CONSTRAINT users_account_type_check CHECK (account_type IN ('organizer', 'provider')) NOT VALID;
