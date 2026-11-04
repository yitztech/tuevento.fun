-- Un intento de pago puede terminar sin cobrarse: la sesión de Stripe caduca, un pago diferido se
-- rechaza o el organizador lo sustituye por otro. Un pago puede además costar 0 si un cupón cubre
-- todo el importe: no pasa por Stripe y nace confirmado (apps/api/src/payments.ts).
-- NOT VALID: se exige en toda escritura nueva y la 031 valida los datos que ya hay. Cada restricción
-- que se quita se sustituye en la línea siguiente por otra más amplia, por eso se ignora Squawk.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- squawk-ignore ban-drop-constraint
ALTER TABLE event_payments DROP CONSTRAINT event_payments_status_check;
ALTER TABLE event_payments ADD CONSTRAINT event_payments_status_check
  CHECK (status IN ('pending', 'paid', 'canceled')) NOT VALID;

-- squawk-ignore ban-drop-constraint
ALTER TABLE event_payments DROP CONSTRAINT event_payments_amount_cents_check;
ALTER TABLE event_payments ADD CONSTRAINT event_payments_amount_cents_check
  CHECK (amount_cents > 0 OR (amount_cents = 0 AND status = 'paid' AND checkout_id IS NULL)) NOT VALID;
