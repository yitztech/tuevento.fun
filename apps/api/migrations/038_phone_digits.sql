SET LOCAL lock_timeout = '5s';

-- Dígitos del teléfono: código de país de 1 a 3 y número de 4 a 14, de 5 a 15 en total (E.164).
-- Los mismos límites que `phoneLimits` (packages/contracts/src/index.ts). NOT VALID: se exige en
-- toda escritura nueva; la 039 valida los datos que ya había.
ALTER TABLE users ADD CONSTRAINT users_phone_digits
  CHECK (phone = '' OR regexp_replace(phone, '\D', '', 'g') ~ '^[0-9]{5,15}$') NOT VALID;
ALTER TABLE provider_profiles ADD CONSTRAINT provider_profiles_phone_digits
  CHECK (phone = '' OR regexp_replace(phone, '\D', '', 'g') ~ '^[0-9]{5,15}$') NOT VALID;
ALTER TABLE provider_profiles ADD CONSTRAINT provider_profiles_whatsapp_digits
  CHECK (whatsapp = '' OR regexp_replace(whatsapp, '\D', '', 'g') ~ '^[0-9]{5,15}$') NOT VALID;
