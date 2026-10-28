-- Pago único por evento según el número de invitados (packages/contracts/src/pricing.ts). Cada pago
-- es un tramo: comprar uno mayor después cobra solo la diferencia. El tramo pagado de un evento es
-- el mayor de sus pagos confirmados por el webhook del proveedor (apps/api/src/payments.ts).
-- Borrar el evento o la cuenta no borra el pago (contabilidad): solo lo desvincula.
-- LOCAL: solo dentro de la transacción de la migración, no en la conexión del pool
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TABLE IF NOT EXISTS event_payments (
  id uuid PRIMARY KEY,
  event_id uuid REFERENCES events(id) ON DELETE SET NULL,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  tier bigint NOT NULL CHECK (tier BETWEEN 0 AND 3),
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL CHECK (currency = 'usd'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  checkout_id text UNIQUE CHECK (char_length(checkout_id) <= 255),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);
CREATE INDEX IF NOT EXISTS event_payments_event_idx ON event_payments(event_id, status);
CREATE INDEX IF NOT EXISTS event_payments_user_idx ON event_payments(user_id);
