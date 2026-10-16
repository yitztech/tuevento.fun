-- Longitudes máximas de la cuenta. Deben coincidir con `accountLimits`
-- (packages/contracts/src/index.ts); packages/contracts/src/limits.test.ts lo comprueba.
-- NOT VALID: se exige en toda escritura nueva sin que un dato antiguo fuera de límite
-- bloquee el arranque de la API.
ALTER TABLE users ADD CONSTRAINT users_first_name_max_length CHECK (char_length(first_name) <= 50) NOT VALID;
ALTER TABLE users ADD CONSTRAINT users_last_name_max_length CHECK (char_length(last_name) <= 50) NOT VALID;
ALTER TABLE users ADD CONSTRAINT users_email_max_length CHECK (char_length(email) <= 254) NOT VALID;
ALTER TABLE users ADD CONSTRAINT users_phone_max_length CHECK (char_length(phone) <= 20) NOT VALID;
