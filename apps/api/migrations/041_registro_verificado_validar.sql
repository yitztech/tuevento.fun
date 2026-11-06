-- Valida la restricción que la 040 añadió con NOT VALID.
-- LOCAL: solo dentro de la transacción de la migración, no en la conexión del pool
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
ALTER TABLE users VALIDATE CONSTRAINT users_account_type_check;
