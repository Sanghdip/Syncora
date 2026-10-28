import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// Required for Node.js environments
neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Add it to server/.env");
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on("error", (err) => {
  console.error("Postgres pool error:", err);
});

// Helper — run a query and return all rows
export const query = (text, params) => pool.query(text, params);

// Helper — run a query and return the first row (or null)
export async function queryOne(text, params) {
  const result = await pool.query(text, params);
  return result.rows[0] || null;
}

// ---- Schema initialization (idempotent) --------------------------------
export async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id              TEXT PRIMARY KEY,
      google_id       TEXT UNIQUE,
      email           TEXT UNIQUE,
      email_verified  BOOLEAN DEFAULT FALSE,
      display_name    TEXT NOT NULL,
      avatar_url      TEXT,
      auth_provider   TEXT NOT NULL,
      role            TEXT NOT NULL DEFAULT 'user',
      is_guest        BOOLEAN NOT NULL DEFAULT FALSE,
      created_at      BIGINT NOT NULL,
      updated_at      BIGINT NOT NULL,
      last_login_at   BIGINT
    );

    CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

    CREATE TABLE IF NOT EXISTS guest_sessions (
      guest_id    TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL,
      created_at  BIGINT NOT NULL,
      expires_at  BIGINT NOT NULL,
      upgraded_to TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_guest_sessions_user ON guest_sessions(user_id);

    CREATE TABLE IF NOT EXISTS rooms (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      owner_id    TEXT NOT NULL,
      is_public   BOOLEAN NOT NULL DEFAULT TRUE,
      created_at  BIGINT NOT NULL,
      updated_at  BIGINT NOT NULL,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_rooms_owner ON rooms(owner_id);
    CREATE INDEX IF NOT EXISTS idx_rooms_public ON rooms(is_public);

    CREATE TABLE IF NOT EXISTS room_messages (
      id          TEXT PRIMARY KEY,
      room_id     TEXT NOT NULL,
      user_id     TEXT NOT NULL,
      text        TEXT NOT NULL,
      created_at  BIGINT NOT NULL,
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_messages_room_time
      ON room_messages(room_id, created_at ASC);
  `);
  console.log("✓ Schema ready");
}

// ---- Graceful shutdown -------------------------------------------------
export async function closePool() {
  await pool.end();
}