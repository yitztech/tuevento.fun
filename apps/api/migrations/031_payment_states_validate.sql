-- Valida las restricciones que la 030 añadió con NOT VALID: los pagos antiguos ya las cumplen.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE event_payments VALIDATE CONSTRAINT event_payments_status_check;
ALTER TABLE event_payments VALIDATE CONSTRAINT event_payments_amount_cents_check;
