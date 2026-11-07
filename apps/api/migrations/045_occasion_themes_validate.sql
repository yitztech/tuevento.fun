SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
ALTER TABLE events VALIDATE CONSTRAINT events_theme_check;
