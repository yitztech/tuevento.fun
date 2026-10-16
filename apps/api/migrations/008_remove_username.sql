-- El correo electrónico sustituye al nombre de usuario como identificador de la cuenta.
ALTER TABLE users DROP COLUMN IF EXISTS username;
