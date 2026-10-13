CREATE TABLE IF NOT EXISTS users (
 id uuid PRIMARY KEY, first_name text NOT NULL, last_name text NOT NULL, email text UNIQUE NOT NULL,
 phone text NOT NULL DEFAULT '', username text UNIQUE NOT NULL, password_hash text, google_sub text UNIQUE,
 avatar text, is_demo boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS events (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, title text NOT NULL,
 description text NOT NULL DEFAULT '', date timestamptz NOT NULL, time_zone text NOT NULL DEFAULT 'America/Mexico_City', location text NOT NULL,
 theme text NOT NULL CHECK(theme IN ('gold','neon','tropical','minimal','floral','kids')), archived boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS invitations (
 id uuid PRIMARY KEY, event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE, name text NOT NULL,
 email text NOT NULL DEFAULT '', phone text NOT NULL DEFAULT '', notes text NOT NULL DEFAULT '',
 kind text NOT NULL CHECK(kind IN ('individual','family')), token text UNIQUE NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS members (
 id uuid PRIMARY KEY, invitation_id uuid NOT NULL REFERENCES invitations(id) ON DELETE CASCADE, name text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('adult','child')), notes text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('accepted','declined','pending')), position int NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS notifications (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE, guest_name text NOT NULL, message text NOT NULL,
 read boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS events_user_idx ON events(user_id);
CREATE INDEX IF NOT EXISTS invitations_event_idx ON invitations(event_id);
CREATE INDEX IF NOT EXISTS members_invitation_idx ON members(invitation_id);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
