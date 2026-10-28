import { nanoid } from "nanoid";
import { query, queryOne } from "../db.js";

const now = () => Date.now();

// ---- Rooms -------------------------------------------------------------

export async function createRoom({ name, ownerId, isPublic = true }) {
  const id = nanoid(10);
  const t = now();
  await query(
    `INSERT INTO rooms (id, name, owner_id, is_public, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, name, ownerId, !!isPublic, t, t]
  );
  return findById(id);
}

export async function findById(id) {
  return queryOne(`SELECT * FROM rooms WHERE id = $1`, [id]);
}

export async function listPublic(limit = 50) {
  const result = await query(
    `SELECT * FROM rooms WHERE is_public = TRUE ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  return result.rows;
}

export async function listByOwner(ownerId) {
  const result = await query(
    `SELECT * FROM rooms WHERE owner_id = $1 ORDER BY created_at DESC`,
    [ownerId]
  );
  return result.rows;
}

export async function deleteRoom(id) {
  // Cascades to room_messages via FK ON DELETE CASCADE
  await query(`DELETE FROM rooms WHERE id = $1`, [id]);
}

export async function isOwner(roomId, userId) {
  const row = await queryOne(
    `SELECT owner_id FROM rooms WHERE id = $1`,
    [roomId]
  );
  return row?.owner_id === userId;
}

export async function touchUpdatedAt(roomId) {
  await query(
    `UPDATE rooms SET updated_at = $1 WHERE id = $2`,
    [now(), roomId]
  );
}

// ---- Messages ----------------------------------------------------------

export async function saveMessage({ roomId, userId, text }) {
  const id = nanoid(12);
  const t = now();
  await query(
    `INSERT INTO room_messages (id, room_id, user_id, text, created_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, roomId, userId, text, t]
  );
  await touchUpdatedAt(roomId);
  return { id, roomId, userId, text, createdAt: t };
}

export async function getHistory(roomId, limit = 100) {
  const result = await query(
    `SELECT m.*, u.display_name, u.avatar_url, u.is_guest
     FROM room_messages m
     JOIN users u ON u.id = m.user_id
     WHERE m.room_id = $1
     ORDER BY m.created_at ASC
     LIMIT $2`,
    [roomId, limit]
  );
  return result.rows.map(row => ({
    id: row.id,
    text: row.text,
    timestamp: Number(row.created_at),
    user: {
      id: row.user_id,
      displayName: row.display_name,
      username: row.display_name,
      avatar: row.avatar_url,
      isGuest: !!row.is_guest,
    },
  }));
}

export async function clearMessages(roomId) {
  await query(`DELETE FROM room_messages WHERE room_id = $1`, [roomId]);
  await touchUpdatedAt(roomId);
}

export function roomToPublic(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    ownerId: row.owner_id,
    isPublic: !!row.is_public,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}