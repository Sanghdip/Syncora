import { nanoid } from "nanoid";
import { query, queryOne } from "../db.js";

const now = () => Date.now();

export function toPublicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    username: row.display_name,
    avatar: row.avatar_url,
    role: row.role,
    isGuest: !!row.is_guest,
    authProvider: row.auth_provider,
  };
}

export async function findById(id) {
  return queryOne(`SELECT * FROM users WHERE id = $1`, [id]);
}

export async function findByGoogleId(googleId) {
  return queryOne(`SELECT * FROM users WHERE google_id = $1`, [googleId]);
}

export async function findByEmail(email) {
  return queryOne(`SELECT * FROM users WHERE email = $1`, [email]);
}

export async function createGuest() {
  const id = `guest_${nanoid(10)}`;
  const displayName = `Guest-${Math.floor(10000 + Math.random() * 90000)}`;
  const avatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(displayName)}`;
  const t = now();
  await query(
    `INSERT INTO users (id, display_name, avatar_url, auth_provider, role, is_guest, created_at, updated_at)
     VALUES ($1, $2, $3, 'guest', 'user', TRUE, $4, $5)`,
    [id, displayName, avatar, t, t]
  );
  return findById(id);
}

export async function createGoogleUser({ googleId, email, emailVerified, name, picture }) {
  const id = `u_${nanoid(12)}`;
  const displayName = name || email.split("@")[0];
  const avatar = picture || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(displayName)}`;
  const t = now();
  await query(
    `INSERT INTO users
       (id, google_id, email, email_verified, display_name, avatar_url,
        auth_provider, role, is_guest, created_at, updated_at, last_login_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'google', 'user', FALSE, $7, $8, $9)`,
    [id, googleId, email, !!emailVerified, displayName, avatar, t, t, t]
  );
  return findById(id);
}

export async function upgradeGuestToGoogle(guestId, { googleId, email, emailVerified, name, picture }) {
  const guest = await findById(guestId);
  if (!guest) return null;
  const t = now();
  const displayName = name || guest.display_name;
  const avatar = picture || guest.avatar_url;
  await query(
    `UPDATE users SET
       google_id = $1, email = $2, email_verified = $3, display_name = $4, avatar_url = $5,
       auth_provider = 'google', is_guest = FALSE, updated_at = $6, last_login_at = $7
     WHERE id = $8`,
    [googleId, email, !!emailVerified, displayName, avatar, t, t, guestId]
  );
  return findById(guestId);
}

export async function touchLastLogin(id) {
  const t = now();
  await query(
    `UPDATE users SET last_login_at = $1, updated_at = $2 WHERE id = $3`,
    [t, t, id]
  );
}

export async function updateProfile(id, { displayName, avatarUrl }) {
  const fields = [];
  const values = [];
  let i = 1;
  if (displayName) { fields.push(`display_name = $${i++}`); values.push(displayName); }
  if (avatarUrl)   { fields.push(`avatar_url = $${i++}`);   values.push(avatarUrl); }
  if (!fields.length) return findById(id);
  fields.push(`updated_at = $${i++}`); values.push(now());
  values.push(id);
  await query(
    `UPDATE users SET ${fields.join(", ")} WHERE id = $${i}`,
    values
  );
  return findById(id);
}

export async function createGuestSession(guestId, ttlMs = 30 * 24 * 60 * 60 * 1000) {
  const t = now();
  await query(
    `INSERT INTO guest_sessions (guest_id, user_id, created_at, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [guestId, guestId, t, t + ttlMs]
  );
}

export async function getGuestSession(guestId) {
  const row = await queryOne(
    `SELECT * FROM guest_sessions WHERE guest_id = $1`,
    [guestId]
  );
  if (!row) return null;
  if (Number(row.expires_at) < now()) {
    await query(`DELETE FROM guest_sessions WHERE guest_id = $1`, [guestId]);
    return null;
  }
  return row;
}

export async function deleteGuestSession(guestId) {
  await query(`DELETE FROM guest_sessions WHERE guest_id = $1`, [guestId]);
}