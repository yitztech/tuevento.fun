ALTER TABLE users ADD COLUMN is_owner boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN registration_platform text NOT NULL DEFAULT 'web';
ALTER TABLE sessions ADD COLUMN platform text NOT NULL DEFAULT 'web';
CREATE TABLE activity (
 id uuid PRIMARY KEY, kind text NOT NULL CHECK(kind IN ('visit','registration','login','download')),
 platform text NOT NULL CHECK(platform IN ('web','android','ios')), visitor_id uuid, user_id uuid REFERENCES users(id) ON DELETE SET NULL,
 route text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX activity_created ON activity(created_at,kind,platform);
CREATE TABLE app_releases (
 id uuid PRIMARY KEY, platform text NOT NULL, version text NOT NULL, build integer NOT NULL,
 channel text NOT NULL, url text NOT NULL, sha256 text, notes text NOT NULL DEFAULT '',
 published_at timestamptz NOT NULL DEFAULT now(), UNIQUE(platform,channel,build)
);
ALTER TABLE sessions ADD COLUMN app_version text NOT NULL DEFAULT 'web';
CREATE TABLE mobile_auth_codes (code_hash text PRIMARY KEY, challenge text NOT NULL, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at timestamptz NOT NULL);
