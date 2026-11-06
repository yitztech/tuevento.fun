SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- Valida las restricciones que la 038 añadió con NOT VALID.
ALTER TABLE users VALIDATE CONSTRAINT users_phone_digits;
ALTER TABLE provider_profiles VALIDATE CONSTRAINT provider_profiles_phone_digits;
ALTER TABLE provider_profiles VALIDATE CONSTRAINT provider_profiles_whatsapp_digits;
